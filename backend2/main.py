from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
import datetime
import jwt
import database, models, schemas

# Initialize DB
models.Base.metadata.create_all(bind=database.engine)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="useAnchor MVP Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security / JWT Utilities ---
SECRET_KEY = "DUMMY_SECRET_FOR_MVP"
ALGORITHM = "HS256"

security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(database.get_db)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    user = db.query(models.Profile).filter(models.Profile.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# --- Background Workers ---
def alert_notification_worker(alert_id: int, db: Session):
    """
    This replaces supabase.functions.invoke('alert-notification-worker').
    In a real app, it would send FCM pushes to contacts.
    """
    print(f"[{datetime.datetime.utcnow()}] (Worker) Dispatching notifications for alert {alert_id}...")
    # Logic to fetch trusted contacts and send pushes would go here.

def check_dead_man_switch():
    print(f"[{datetime.datetime.utcnow()}] Running dead-man switch check...")
    db = database.SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        # Find active sessions that have passed their expected end time
        overdue_sessions = db.query(models.AnchorSession).filter(
            models.AnchorSession.status == "active",
            models.AnchorSession.expected_end < now
        ).all()
        
        for session in overdue_sessions:
            existing_alert = db.query(models.Alert).filter(
                models.Alert.session_id == session.id,
                models.Alert.resolved_at == None
            ).first()
            
            if not existing_alert:
                print(f"Triggering missed_checkin alert for session {session.id}")
                new_alert = models.Alert(
                    session_id=session.id,
                    trigger_type="missed_checkin"
                )
                db.add(new_alert)
                session.status = "sos"
                db.commit()
                # Run the notification worker sync here since we're in a separate thread anyway
                alert_notification_worker(new_alert.id, db)
    finally:
        db.close()

scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup_event():
    scheduler.add_job(check_dead_man_switch, 'interval', minutes=1, next_run_time=datetime.datetime.utcnow())
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()


# ==========================================
# 1. Authentication
# ==========================================
@app.post("/api/auth/send-otp")
def send_otp(request: schemas.OTPRequest):
    # Dummy implementation
    return {"message": f"OTP sent to {request.phone}"}

@app.post("/api/auth/verify-otp", response_model=schemas.TokenResponse)
def verify_otp(request: schemas.OTPVerifyRequest, db: Session = Depends(database.get_db)):
    if request.token != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP. Use 123456")
    
    user = db.query(models.Profile).filter(models.Profile.phone == request.phone).first()
    if not user:
        user = models.Profile(phone=request.phone)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/logout")
def logout(current_user: models.Profile = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


# ==========================================
# 2. User Profiles
# ==========================================
@app.get("/api/profiles/me", response_model=schemas.ProfileResponse)
def get_profile(current_user: models.Profile = Depends(get_current_user)):
    return current_user

@app.put("/api/profiles/me", response_model=schemas.ProfileResponse)
def update_profile(update: schemas.ProfileUpdate, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    if update.full_name is not None:
        current_user.full_name = update.full_name
    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url
    if update.onboarding_completed is not None:
        current_user.onboarding_completed = update.onboarding_completed
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/api/profiles/fcm-token")
def update_fcm_token(request: schemas.FCMTokenUpdate, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    current_user.fcm_token = request.fcm_token
    db.commit()
    return {"message": "FCM token updated"}

@app.delete("/api/profiles/account")
def delete_account(db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted"}


# ==========================================
# 3. Safety Sessions
# ==========================================
@app.post("/api/sessions", response_model=schemas.SessionResponse)
def create_session(request: schemas.SessionCreate, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session_data = request.dict()
    if session_data.get("expected_end") and session_data["expected_end"].tzinfo:
        session_data["expected_end"] = session_data["expected_end"].replace(tzinfo=None)
    new_session = models.AnchorSession(**session_data, user_id=current_user.id, status="draft")
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.post("/api/sessions/{session_id}/contacts")
def add_session_contacts(session_id: int, request: schemas.SessionContactsRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    # Mocking: In a real DB, we'd have a session_contacts join table. For MVP, we'll just acknowledge.
    return {"message": f"Added {len(request.contact_ids)} contacts to session {session_id}"}

@app.post("/api/sessions/{session_id}/start")
def start_session(session_id: int, request: schemas.SessionActionRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "active"
    session.starts_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Session started successfully"}

@app.post("/api/sessions/{session_id}/complete")
def complete_session(session_id: int, request: schemas.SessionActionRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "ended"
    db.commit()
    return {"message": "Session completed successfully"}

class SessionExtendRequest(schemas.SessionActionRequest):
    new_expected_end: str

@app.post("/api/sessions/{session_id}/extend")
def extend_session(session_id: int, request: SessionExtendRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    dt = datetime.datetime.fromisoformat(request.new_expected_end.replace('Z', '+00:00'))
    session.expected_end = dt.replace(tzinfo=None) if dt.tzinfo else dt
    db.commit()
    return {"message": "Session extended successfully"}

@app.get("/api/sessions/active", response_model=schemas.SessionResponse)
def get_active_session(db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(
        models.AnchorSession.user_id == current_user.id, 
        models.AnchorSession.status.in_(["active", "sos", "emergency"])
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
    return session

@app.get("/api/sessions/history", response_model=list[schemas.SessionResponse])
def get_session_history(db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    return db.query(models.AnchorSession).filter(models.AnchorSession.user_id == current_user.id, models.AnchorSession.status != "draft").all()

@app.get("/api/sessions/{session_id}", response_model=schemas.SessionResponse)
def get_session_details(session_id: int, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.get("/api/sessions/{session_id}/checkins")
def get_session_checkins(session_id: int, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    return db.query(models.Checkin).filter(models.Checkin.session_id == session_id).order_by(models.Checkin.id).all()

@app.get("/api/sessions/{session_id}/alerts")
def get_session_alerts(session_id: int, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    return db.query(models.Alert).filter(models.Alert.session_id == session_id).order_by(models.Alert.triggered_at).all()

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # Soft delete (since models aren't provided with deleted_at in schemas, we might just hard delete or ignore for MVP)
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


# ==========================================
# 4. Check-ins
# ==========================================
@app.post("/api/checkins/{checkin_id}/complete")
def complete_checkin(checkin_id: int, request: schemas.CheckinCompleteRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    checkin = db.query(models.Checkin).filter(models.Checkin.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in not found")
    checkin.completed_at = datetime.datetime.utcnow()
    checkin.response = "safe"
    db.commit()
    return {"message": "Check-in marked as completed"}


# ==========================================
# 5. Emergency Alerts
# ==========================================
@app.post("/api/alerts/trigger")
def trigger_alert(request: schemas.AlertTriggerRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == request.p_session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.status = "sos"
    new_alert = models.Alert(
        session_id=request.p_session_id,
        trigger_type=request.p_trigger_type,
        location_lat=request.p_lat,
        location_lng=request.p_lng,
        location_accuracy=request.p_accuracy,
        location_address=request.p_address
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    
    # Trigger background worker for push notifications
    background_tasks.add_task(alert_notification_worker, new_alert.id, db)
    
    return {"message": "SOS alert triggered", "alert_id": new_alert.id}

@app.post("/api/alerts/{alert_id}/cancel")
def cancel_alert(alert_id: int, request: schemas.AlertCancelRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved_at = datetime.datetime.utcnow()
    alert.resolution_reason = "cancelled_false_alarm"
    
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == alert.session_id).first()
    if session:
        session.status = "ended"
        
    db.commit()
    return {"message": "Alert cancelled successfully"}

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, request: schemas.AlertResolveRequest, db: Session = Depends(database.get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved_at = datetime.datetime.utcnow()
    alert.resolution_reason = request.p_resolution_reason
    alert.resolution_details = request.p_resolution_details
    
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == alert.session_id).first()
    if session:
        session.status = "ended"
        
    db.commit()
    return {"message": "Alert resolved"}

@app.get("/api/alerts", response_model=list[schemas.AlertResponse])
def get_alerts(db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    # Very simplified view for MVP
    return db.query(models.Alert).all()

@app.get("/api/alerts/{alert_id}")
def get_alert_details(alert_id: int, db: Session = Depends(database.get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == alert.session_id).first()
    user = db.query(models.Profile).filter(models.Profile.id == session.user_id).first() if session else None
    
    return {
        "id": alert.id,
        "status": "active" if not alert.resolved_at else "resolved",
        "created_at": alert.created_at,
        "trigger_type": alert.trigger_type,
        "location_lat": alert.location_lat,
        "location_lng": alert.location_lng,
        "location_address": alert.location_address,
        "session": {
            "title": session.title if session else "Unknown",
            "meet_person": session.meet_person if session else "",
            "destination_address": session.destination_address if session else "",
            "description": session.description if session else ""
        } if session else None,
        "profile": {
            "full_name": user.full_name if user else "Unknown User",
            "avatar_url": user.avatar_url if user else None,
            "phone": user.phone if user else None
        } if user else None
    }


# ==========================================
# 6. Trusted Contacts
# ==========================================
@app.get("/api/contacts", response_model=list[schemas.ContactResponse])
def list_contacts(db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    return db.query(models.TrustedContact).filter(models.TrustedContact.user_id == current_user.id).all()

@app.get("/api/contacts/{contact_id}", response_model=schemas.ContactResponse)
def get_contact(contact_id: int, db: Session = Depends(database.get_db)):
    contact = db.query(models.TrustedContact).filter(models.TrustedContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@app.post("/api/contacts", response_model=schemas.ContactResponse)
def create_contact(request: schemas.ContactCreate, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    new_contact = models.TrustedContact(**request.dict(), user_id=current_user.id)
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@app.put("/api/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(contact_id: int, request: schemas.ContactUpdate, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    contact = db.query(models.TrustedContact).filter(models.TrustedContact.id == contact_id, models.TrustedContact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    if request.name is not None: contact.name = request.name
    if request.phone_number is not None: contact.phone_number = request.phone_number
    if request.relationship is not None: contact.relationship = request.relationship
    if request.is_emergency_contact is not None: contact.is_emergency_contact = request.is_emergency_contact
    
    db.commit()
    db.refresh(contact)
    return contact

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    contact = db.query(models.TrustedContact).filter(models.TrustedContact.id == contact_id, models.TrustedContact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact deleted"}

@app.post("/api/contacts/{contact_id}/opt-in")
def opt_in_contact(contact_id: int, request: schemas.ContactOptInRequest, db: Session = Depends(database.get_db)):
    contact = db.query(models.TrustedContact).filter(models.TrustedContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.opted_in = True
    db.commit()
    return {"message": "Contact opted in successfully"}
