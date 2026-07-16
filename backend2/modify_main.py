import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

worker_code = """
async def session_start_notification_worker(session_id: int, db: Session):
    print(f"[{datetime.datetime.utcnow()}] (Worker) Dispatching start notifications for session {session_id}...")
    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id).first()
    if not session:
        return
        
    user = db.query(models.Profile).filter(models.Profile.id == session.user_id).first()
    user_name = user.full_name or user.phone if user else "A useAnchor user"

    session_contacts = db.query(models.SessionContact).filter(models.SessionContact.session_id == session.id).all()
    if session_contacts:
        contact_ids = [sc.contact_id for sc in session_contacts]
        contacts = db.query(models.TrustedContact).filter(models.TrustedContact.id.in_(contact_ids)).all()
    else:
        contacts = db.query(models.TrustedContact).filter(models.TrustedContact.user_id == session.user_id).all()
    
    # WebSocket and SMS notifications
    for contact in contacts:
        profile = db.query(models.Profile).filter(models.Profile.phone == contact.phone_number).first()
        if profile and profile.id in manager.active_connections:
            message = {
                "type": "NEW_ALERT",
                "alert": {
                    "session_id": session.id,
                    "trigger_type": "session_start",
                    "status": "active"
                }
            }
            # send_personal_message is async
            import asyncio
            asyncio.create_task(manager.send_personal_message(message, profile.id))
            
        twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        twilio_from = os.getenv("TWILIO_FROM_NUMBER")
        
        sms_body = f"useAnchor: {user_name} has started a new safety session ('{session.title}') and added you as a trusted contact."
        
        if twilio_sid and twilio_token and twilio_from and "dummy" not in twilio_sid.lower():
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
                data = urllib.parse.urlencode({
                    "To": contact.phone_number,
                    "From": twilio_from,
                    "Body": sms_body
                }).encode('utf-8')
                
                auth_str = f"{twilio_sid}:{twilio_token}"
                b64_auth = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
                
                req = urllib.request.Request(url, data=data)
                req.add_header("Authorization", f"Basic {b64_auth}")
                urllib.request.urlopen(req)
                print(f"[Twilio] Sent start SMS to {contact.phone_number}")
            except Exception as e:
                print(f"[Twilio] ERROR sending start SMS to {contact.phone_number}: {e}")
                
    contact_phones = [c.phone_number for c in contacts]
    contact_profiles = db.query(models.Profile).filter(
        models.Profile.phone.in_(contact_phones),
        models.Profile.fcm_token.isnot(None)
    ).all()
    
    tokens = [p.fcm_token for p in contact_profiles]
    if tokens:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=f"Anchor Created by {user_name}",
                body=f"{user_name} started a new safety session: {session.title}",
            ),
            data={
                "sessionId": str(session.id),
                "type": "session_start"
            },
            tokens=tokens,
        )
        try:
            response = messaging.send_each_for_multicast(message)
            print(f"Start Session FCM: {response.success_count} messages sent.")
        except Exception as e:
            print(f"Error sending FCM multicast: {e}")

def check_dead_man_switch():
"""

content = content.replace("def check_dead_man_switch():", worker_code)

old_start = 'def start_session(session_id: int, request: schemas.SessionActionRequest, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):\n    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()'

new_start = 'def start_session(session_id: int, request: schemas.SessionActionRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.Profile = Depends(get_current_user)):\n    session = db.query(models.AnchorSession).filter(models.AnchorSession.id == session_id, models.AnchorSession.user_id == current_user.id).first()'

content = content.replace(old_start, new_start)

old_end = '        db.add(first_checkin)\n        \n    db.commit()\n    return {"message": "Session started successfully"}'
new_end = '        db.add(first_checkin)\n        \n    db.commit()\n    background_tasks.add_task(session_start_notification_worker, session.id, db)\n    return {"message": "Session started successfully"}'

content = content.replace(old_end, new_end)

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Modification complete.")
