from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    onboarding_completed = Column(Boolean, default=False)
    fcm_token = Column(String, nullable=True)
    
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)

class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("profiles.id"))
    name = Column(String)
    phone_number = Column(String)
    relationship = Column(String, nullable=True)
    is_emergency_contact = Column(Boolean, default=False)
    opt_in_token = Column(String, nullable=True)
    opted_in = Column(Boolean, default=False)

class SessionContact(Base):
    __tablename__ = "session_contacts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    contact_id = Column(Integer, ForeignKey("trusted_contacts.id"))

class AnchorSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("profiles.id"))
    title = Column(String)
    description = Column(String, nullable=True)
    meet_person = Column(String)
    meet_phone = Column(String, nullable=True)
    meet_person_images = Column(String, nullable=True) # JSON array of image URLs
    destination_address = Column(String, nullable=True)
    checkin_interval_minutes = Column(Integer, default=30)
    
    starts_at = Column(DateTime, nullable=True)
    expected_end = Column(DateTime)
    
    status = Column(String, default="draft") # draft, active, ended, sos
    
class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    response = Column(String, nullable=True) # safe, extend, end, sos, missed
    scheduled_for = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    trigger_type = Column(String) # manual_sos, missed_checkin, checkin_help
    
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
    location_address = Column(String, nullable=True)
    
    triggered_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolution_reason = Column(String, nullable=True)
    resolution_details = Column(String, nullable=True)

class AlertRecipient(Base):
    __tablename__ = "alert_recipients"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    contact_id = Column(Integer, ForeignKey("trusted_contacts.id"))
    is_responding = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime, nullable=True)
    
    # Optional relationships to make fetching easier
    # alert = relationship("Alert")
    # contact = relationship("TrustedContact")
