from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
import datetime
import jwt
import random
import database, models, schemas
import os
import firebase_admin
from firebase_admin import credentials, messaging

# Initialize DB
models.Base.metadata.create_all(bind=database.engine)

from dotenv import load_dotenv
load_dotenv()

import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key_id": "",
            "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "client_id": "",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.getenv('FIREBASE_CLIENT_EMAIL', '').replace('@', '%40')}"
        })
        firebase_admin.initialize_app(cred)
        print("Firebase Admin initialized successfully")
except Exception as e:
    print(f"Failed to initialize Firebase Admin: {e}")

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="useAnchor MVP Backend", version="2.0.0")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security / JWT Utilities ---
SECRET_KEY = os.getenv("SECRET_KEY", "DUMMY_SECRET_FOR_MVP")
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
    Sends FCM pushes to trusted contacts for a given alert.
    """
    print(f"[{datetime.datetime.utcnow()}] (Worker) Dispatching notifications for alert {alert_id}...")
    
    # 1. Get the alert and session
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        print("Alert not found.")
        return
        
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == alert.session_id).first()
    if not session:
        print("Session not found.")
        return
        
    user = db.query(models.Profile).filter(models.Profile.id == session.user_id).first()
    user_name = user.full_name or user.phone if user else "A useAnchor user"

    # 2. Get trusted contacts selected for this specific session
    session_contacts = db.query(models.SessionContact).filter(models.SessionContact.session_id == session.id).all()
    
    if session_contacts:
        contact_ids = [sc.contact_id for sc in session_contacts]
        contacts = db.query(models.TrustedContact).filter(models.TrustedContact.id.in_(contact_ids)).all()
    else:
        # Fallback to all trusted contacts if none were selected for the session
        print("No specific contacts chosen for session, falling back to all trusted contacts.")
        contacts = db.query(models.TrustedContact).filter(models.TrustedContact.user_id == session.user_id).all()
    
    # 3. Find contacts who are also users and have an FCM token
    contact_phones = [c.phone_number for c in contacts]
    contact_profiles = db.query(models.Profile).filter(
        models.Profile.phone.in_(contact_phones),
        models.Profile.fcm_token.isnot(None)
    ).all()
    
    tokens = [p.fcm_token for p in contact_profiles]
    
    if not tokens:
        print(f"No FCM tokens found for contacts of user {session.user_id}")
        return
        
    # 4. Send the push
    reason = "triggered an SOS!" if alert.trigger_type == "manual_sos" else "missed their safety check-in!"
    
    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=f"🚨 Emergency Alert from {user_name}",
            body=f"{user_name} has {reason} Open useAnchor to view their location.",
        ),
        data={
            "alertId": str(alert_id),
            "sessionId": str(session.id),
            "type": "emergency_alert"
        },
        tokens=tokens,
    )
    
    try:
        response = messaging.send_each_for_multicast(message)
        print(f"Successfully sent {response.success_count} messages; {response.failure_count} failed.")
    except Exception as e:
        print(f"Error sending FCM multicast: {e}")

def check_dead_man_switch():
    print(f"[{datetime.datetime.utcnow()}] Running dead-man switch check...")
    db = database.SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        # Find active sessions
        active_sessions = db.query(models.AnchorSession).filter(models.AnchorSession.status == "active").all()
        
        for session in active_sessions:
            needs_sos = False
            
            # Check 1: Past expected end time
            if session.expected_end < now:
                needs_sos = True
                print(f"Session {session.id} past expected end time")
            else:
                # Check 2: Missed check-in
                overdue_checkin = db.query(models.Checkin).filter(
                    models.Checkin.session_id == session.id,
                    models.Checkin.completed_at.is_(None),
                    models.Checkin.scheduled_for < now
                ).first()
                if overdue_checkin:
                    needs_sos = True
                    print(f"Session {session.id} missed scheduled check-in")
            
            if needs_sos:
                existing_alert = db.query(models.Alert).filter(
                    models.Alert.session_id == session.id,
                    models.Alert.resolved_at.is_(None)
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
def send_otp(request: schemas.OTPRequest, db: Session = Depends(database.get_db)):
    # 1. Check if user exists, if not, create them early to store the OTP
    user = db.query(models.Profile).filter(models.Profile.phone == request.phone).first()
    if not user:
        user = models.Profile(phone=request.phone)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # 2. Generate OTP
    otp = str(random.randint(100000, 999999))
    
    # 3. Save to profile
    user.otp_code = otp
    user.otp_expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    db.commit()
    
    # 4. Return OTP directly in response for MVP testing
    print(f"Generated OTP {otp} for {request.phone}")
    return {"message": f"OTP sent to {request.phone}", "test_otp": otp}

@app.post("/api/auth/verify-otp", response_model=schemas.TokenResponse)
def verify_otp(request: schemas.OTPVerifyRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.Profile).filter(models.Profile.phone == request.phone).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please request a new OTP.")
        
    if not user.otp_code or user.otp_code != request.token:
        # Fallback to 123456 strictly for old frontend code that might not handle the test_otp yet
        if request.token != "123456":
            raise HTTPException(status_code=400, detail="Invalid OTP code.")
            
    if user.otp_expires_at and datetime.datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
        
    # Clear OTP after successful use
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
        
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

@app.post("/api/profiles/avatar")
async def upload_avatar(file: UploadFile = File(...), db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(contents, folder="useanchor_avatars")
        
        current_user.avatar_url = result.get("secure_url")
        db.commit()
        db.refresh(current_user)
        
        return {"avatar_url": current_user.avatar_url, "message": "Avatar uploaded successfully"}
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image.")

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
    # Remove any existing session contacts before adding the new ones
    db.query(models.SessionContact).filter(models.SessionContact.session_id == session_id).delete()
    
    for contact_id in request.contact_ids:
        session_contact = models.SessionContact(session_id=session_id, contact_id=contact_id)
        db.add(session_contact)
        
    db.commit()
    return {"message": f"Added {len(request.contact_ids)} contacts to session {session_id}"}

@app.post("/api/sessions/{session_id}/start")
def start_session(session_id: int, request: schemas.SessionActionRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "active"
    session.starts_at = datetime.datetime.utcnow()
    
    # Schedule the first checkin
    next_checkin_time = session.starts_at + datetime.timedelta(minutes=session.checkin_interval_minutes)
    if next_checkin_time < session.expected_end:
        first_checkin = models.Checkin(
            session_id=session.id,
            scheduled_for=next_checkin_time
        )
        db.add(first_checkin)
        
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
    
    # Schedule the next check-in
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == checkin.session_id).first()
    if session and session.status == "active":
        next_checkin_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=session.checkin_interval_minutes)
        if next_checkin_time < session.expected_end:
            next_checkin = models.Checkin(
                session_id=session.id,
                scheduled_for=next_checkin_time
            )
            db.add(next_checkin)
            
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

@app.get("/api/alerts")
def get_alerts(db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):
    # Get all user IDs where current_user is a trusted contact
    trusted_relationships = db.query(models.TrustedContact).filter(models.TrustedContact.phone_number == current_user.phone).all()
    trusted_user_ids = [rel.user_id for rel in trusted_relationships]
    
    # Also include the user's own alerts just in case
    trusted_user_ids.append(current_user.id)
    
    # Get all alerts for sessions owned by those users
    alerts = db.query(models.Alert).join(models.AnchorSession).filter(models.AnchorSession.user_id.in_(trusted_user_ids)).order_by(models.Alert.triggered_at.desc()).all()
    
    response = []
    for alert in alerts:
        session = db.query(models.AnchorSession).filter(models.AnchorSession.id == alert.session_id).first()
        user = db.query(models.Profile).filter(models.Profile.id == session.user_id).first() if session else None
        
        response.append({
            "id": str(alert.id),
            "userId": str(user.id) if user else "",
            "userName": user.full_name if user and user.full_name else (user.phone if user else "Unknown"),
            "userAvatar": user.avatar_url if user and user.avatar_url else "",
            "triggeredAt": alert.triggered_at.isoformat() + "Z",
            "triggerReason": "SOS Triggered" if alert.trigger_type == "manual_sos" else "Missed Check-In",
            "sessionTitle": session.title if session else "Unknown Session",
            "status": "resolved" if alert.resolved_at else "active",
            "lastKnownLocation": {
                "lat": alert.location_lat or 0.0,
                "lng": alert.location_lng or 0.0,
                "address": alert.location_address or "Unknown Location"
            },
            "resolvedAt": alert.resolved_at.isoformat() + "Z" if alert.resolved_at else None
        })
        
    return response

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
