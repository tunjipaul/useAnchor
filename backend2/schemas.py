from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# --- Auth Schemas ---
class OTPRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+[1-9]\d{1,14}$")

class OTPVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+[1-9]\d{1,14}$")
    token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    is_new_user: bool = False

# --- Profile Schemas ---
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=50)
    avatar_url: Optional[str] = None
    onboarding_completed: Optional[bool] = None

class FCMTokenUpdate(BaseModel):
    fcm_token: str

class ProfileResponse(BaseModel):
    id: int
    phone: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    onboarding_completed: bool
    fcm_token: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- Contact Schemas ---
class ContactCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    phone_number: str = Field(..., pattern=r"^\+[1-9]\d{1,14}$")
    relationship: Optional[str] = Field(None, max_length=50)
    is_emergency_contact: bool = False

class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    phone_number: Optional[str] = Field(None, pattern=r"^\+[1-9]\d{1,14}$")
    relationship: Optional[str] = Field(None, max_length=50)
    is_emergency_contact: Optional[bool] = None

class ContactOptInRequest(BaseModel):
    p_contact_id: int
    p_token: str

class ContactResponse(BaseModel):
    id: int
    user_id: int
    name: str
    phone_number: str
    relationship: Optional[str] = None
    is_emergency_contact: bool
    opted_in: bool
    has_account: bool = False
    
    class Config:
        from_attributes = True

# --- Session Schemas ---
class SessionCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    meet_person: str = Field(..., min_length=2, max_length=100)
    meet_phone: Optional[str] = Field(None, pattern=r"^\+[1-9]\d{1,14}$")
    destination_address: Optional[str] = Field(None, max_length=250)
    person_image_urls: List[str] = Field(default_factory=list)
    checkin_interval_minutes: int = Field(30, ge=1, le=1440)
    expected_end: datetime

class SessionContactsRequest(BaseModel):
    contact_ids: List[int]

class SessionActionRequest(BaseModel):
    p_session_id: int
    p_current_version: Optional[int] = 1

class SessionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    meet_person: str
    meet_phone: Optional[str] = None
    destination_address: Optional[str] = None
    person_image_urls: List[str] = Field(default_factory=list)
    checkin_interval_minutes: int
    starts_at: Optional[datetime] = None
    expected_end: datetime
    status: str
    contacts: List[ContactResponse] = Field(default_factory=list)
    
    class Config:
        from_attributes = True

# --- Checkin Schemas ---
class CheckinCompleteRequest(BaseModel):
    p_checkin_id: int

class CheckinResponse(BaseModel):
    id: int
    session_id: int
    response: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# --- Alert Schemas ---
class AlertTriggerRequest(BaseModel):
    p_session_id: int
    p_trigger_type: str = "manual_sos"
    p_lat: Optional[float] = None
    p_lng: Optional[float] = None
    p_accuracy: Optional[float] = None
    p_address: Optional[str] = None

class AlertCancelRequest(BaseModel):
    p_alert_id: int

class AlertResolveRequest(BaseModel):
    p_alert_id: int
    p_resolution_reason: str
    p_resolution_details: str

class AlertResponse(BaseModel):
    id: int
    session_id: int
    trigger_type: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_address: Optional[str] = None
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_reason: Optional[str] = None
    resolution_details: Optional[str] = None
    
    class Config:
        from_attributes = True
