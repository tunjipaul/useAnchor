import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import {
  X,
  MapPin,
  User,
  Plus,
  ArrowRight,
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../auth/stores/useAuthStore";
import { useSession } from "../hooks/useSession";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getFriendlyErrorMessage } from "../../../lib/errorHelpers";

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  selected: boolean;
}

export default function CreateSessionScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { createAndStartSession, completeSession, isLoading: isCreating } = useSession();
  const [currentStep, setCurrentStep] = useState(1);

  // Geolocation & Map State
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const customIcon = useMemo(() => {
    return L.divIcon({
      html: `<div class="relative flex items-center justify-center">
               <div class="absolute w-8 h-8 bg-[#ac2d00]/30 rounded-full opacity-25 animate-ping"></div>
               <div class="relative w-4 h-4 bg-[#ac2d00] rounded-full border-2 border-white shadow-md flex items-center justify-center">
                  <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
               </div>
            </div>`,
      className: "bg-transparent border-none",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, []);

  // Fetch current coordinates on mount for map review preview
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        (err) => {
          console.warn("Error getting location: ", err);
          // Fallback to default (Lagos)
          setLat(6.5244);
          setLng(3.3792);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLat(6.5244);
      setLng(3.3792);
    }
  }, []);

  // Form State
  const [title, setTitle] = useState("Marketplace Pickup");
  const [personName, setPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("Coffee House, 4th Ave");
  
  // Date and Time init
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(timeStr);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const durationOptions = [15, 30, 45, 60];
  const [customDuration, setCustomDuration] = useState(false);

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [_isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [addContactError, setAddContactError] = useState<string | null>(null);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isForceEnding, setIsForceEnding] = useState(false);

  async function handleForceEndActiveSession() {
    if (!user) return;
    setIsForceEnding(true);
    setStartSessionError(null);
    try {
      // 1. Fetch active session details
      const activeSession = await apiFetch<any>("/sessions/active");

      if (activeSession) {
        // 2. Complete the stuck session
        await completeSession(activeSession.id, activeSession.session_version || 1);
        
        // 3. Auto-retry starting the new session
        await handleStartSession();
      } else {
        setStartSessionError("No active session found in the database. Please try starting the session again.");
      }
    } catch (e: any) {
      setStartSessionError(getFriendlyErrorMessage(e, "Failed to force-end active session."));
    } finally {
      setIsForceEnding(false);
    }
  }

  // Fetch active contacts from database on mount
  useEffect(() => {
    async function loadContacts() {
      if (!user) return;
      setIsLoadingContacts(true);
      try {
        const data = await apiFetch<any[]>("/contacts");
        if (data) {
          setContacts(
            data.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone_number,
              avatarUrl: undefined,
              selected: false,
            }))
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingContacts(false);
      }
    }
    loadContacts();
  }, [user]);

  // Step Validation
  const isStep1Valid = title.trim() !== "" && location.trim() !== "" && personName.trim() !== "" && phone.trim() !== "";
  const selectedContactsCount = contacts.filter((c) => c.selected).length;
  const isStep2Valid = selectedContactsCount > 0;

  function nextStep() {
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
    } else if (currentStep === 2 && isStep2Valid) {
      setCurrentStep(3);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  function toggleContact(id: string) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  }

  async function handleAddNewContact() {
    if (newContactName.trim() === "" || newContactPhone.trim() === "" || !user) return;
    setAddContactError(null);

    // Validate phone number using libphonenumber-js
    const phoneObj = parsePhoneNumberFromString(newContactPhone.trim(), "US");
    if (!phoneObj || !phoneObj.isValid()) {
      setAddContactError("Please enter a valid phone number in international format (e.g. +234...).");
      return;
    }
    const formattedPhone = phoneObj.number;
    
    setIsLoadingContacts(true);
    try {
      // Add to DB
      const data = await apiFetch<any>("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: newContactName.trim(),
          phone_number: formattedPhone,
        })
      });

      const newContact: Contact = {
        id: data.id,
        name: data.name,
        phone: data.phone_number,
        selected: true,
      };
      setContacts((prev) => [...prev, newContact]);
      setNewContactName("");
      setNewContactPhone("");
      setAddContactError(null);
      setShowAddContact(false);
    } catch (error: any) {
      setAddContactError(getFriendlyErrorMessage(error, "Failed to add contact."));
    } finally {
      setIsLoadingContacts(false);
    }
  }

  async function handleStartSession() {
    if (!user) return;
    setStartSessionError(null);
    try {
      const selectedContactIds = contacts.filter((c) => c.selected).map((c) => c.id);
      
      const sessionId = await createAndStartSession(
        {
          title,
          meet_person: personName || undefined,
          meet_phone: phone || undefined,
          destination_address: location || undefined,
          destination_lat: lat || undefined,
          destination_lng: lng || undefined,
          durationMinutes,
          notes: notes || undefined,
          startDate: new Date(`${date}T${time}:00`),
        },
        selectedContactIds
      );

      navigate(`/session/active?id=${sessionId}`);
    } catch (e: any) {
      setStartSessionError(getFriendlyErrorMessage(e, "Could not start safety session."));
    }
  }

  return (
    <div
      className="flex-grow flex flex-col items-center justify-start px-4 overflow-y-auto w-full"
      style={{ backgroundColor: "#fff8f6" }}
    >
      {/* Mobile container wrapper */}
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8 space-y-6">
        {/* Top Header */}
        <header className="w-full flex items-center justify-between px-2 mb-4">
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Cancel session creation"
            className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform hover:bg-[#ffe9e4]"
            style={{ color: "#261814" }}
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#5a413a]">
              Step {currentStep} of 3
            </span>
          </div>
          <div className="w-10" /> {/* Spacer for symmetry */}
        </header>

        {/* Form Content Steps with Animations */}
        <div className="flex-grow px-2">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.section
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-left">
                  <h1 className="text-[28px] font-semibold text-[#261814] tracking-tight leading-tight">
                    Meeting Details
                  </h1>
                  <p className="text-[16px] text-[#5a413a]">
                    Tell us who you're meeting and where.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Session Title */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[12px] font-semibold tracking-wider text-[#5a413a] uppercase">
                      Session Title
                    </label>
                    <input
                      className="w-full h-12 px-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[16px] outline-none transition-all"
                      placeholder="e.g. Marketplace Pickup"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  {/* Person Name & Phone */}
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-semibold tracking-wider text-[#5a413a] uppercase">
                        Person's Name
                      </label>
                      <input
                        className="w-full h-12 px-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[16px] outline-none transition-all"
                        placeholder="e.g. Alex"
                        type="text"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-semibold tracking-wider text-[#5a413a] uppercase">
                        Phone
                      </label>
                      <input
                        className="w-full h-12 px-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[16px] outline-none transition-all"
                        placeholder="e.g. +234..."
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Divider and Meeting Details */}
                  <div className="space-y-4 pt-4 border-t border-[#e2bfb5] text-left">
                    <h2 className="text-[18px] font-bold text-[#261814]">
                      Where and when?
                    </h2>
                    
                    {/* Location Input */}
                    <div className="relative flex flex-col gap-1.5">
                      <div className="relative">
                        <MapPin
                          size={20}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ac2d00]"
                        />
                        <input
                          className="w-full h-12 pl-12 pr-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[16px] outline-none transition-all"
                          placeholder="Set meeting location"
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Date & Time Picker */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <input
                          className="w-full h-12 px-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[15px] outline-none transition-all"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <input
                          className="w-full h-12 px-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[15px] outline-none transition-all"
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Session Duration Picker */}
                    <div className="space-y-2 pt-4 border-t border-[#e2bfb5]">
                      <label className="text-[12px] font-semibold tracking-wider text-[#5a413a] uppercase flex items-center gap-1.5">
                        <Clock size={14} className="text-[#ac2d00]" />
                        Session Duration
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {durationOptions.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              setDurationMinutes(mins);
                              setCustomDuration(false);
                            }}
                            className={`h-11 rounded-lg text-[14px] font-bold transition-all active:scale-95 ${
                              durationMinutes === mins && !customDuration
                                ? "bg-[#ac2d00] text-white shadow-sm"
                                : "bg-white border border-[#e2bfb5] text-[#5a413a] hover:border-[#ac2d00]"
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCustomDuration(true)}
                          className={`h-11 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${
                            customDuration
                              ? "bg-[#ac2d00] text-white shadow-sm"
                              : "bg-white border border-[#e2bfb5] text-[#5a413a] hover:border-[#ac2d00]"
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                      {customDuration && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="number"
                            min={1}
                            max={480}
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                            className="w-24 h-11 px-3 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[16px] font-bold text-center outline-none transition-all"
                          />
                          <span className="text-[14px] text-[#5a413a] font-medium">minutes</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {currentStep === 2 && (
              <motion.section
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-left">
                  <h1 className="text-[28px] font-semibold text-[#261814] tracking-tight leading-tight">
                    Safety Circle
                  </h1>
                  <p className="text-[16px] text-[#5a413a]">
                    Select contacts to monitor this session.
                  </p>
                </div>

                <div className="space-y-5 text-left">
                  {/* Contact Selection */}
                  <div className="space-y-3">
                    <label className="text-[12px] font-semibold tracking-wider text-[#5a413a] uppercase">
                      Trusted Contacts
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => toggleContact(contact.id)}
                          className={`px-4 py-2.5 rounded-full border text-[14px] font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                            contact.selected
                              ? "bg-[#ffe9e4] text-[#ac2d00] border-[#ac2d00]"
                              : "bg-[#fff1ed] text-[#5a413a] border-[#e2bfb5]"
                          }`}
                        >
                          <User size={16} />
                          <span>{contact.name}</span>
                          {contact.selected && (
                            <CheckCircle size={14} className="text-[#ac2d00] fill-white" />
                          )}
                        </button>
                      ))}

                      {/* Add new contact button */}
                      <button
                        onClick={() => {
                          setAddContactError(null);
                          setShowAddContact(!showAddContact);
                        }}
                        className="px-4 py-2.5 bg-white text-[#ac2d00] rounded-full border border-dashed border-[#ac2d00] text-[14px] font-medium flex items-center gap-1.5 hover:bg-[#ffe9e4] transition-all"
                      >
                        <Plus size={16} />
                        <span>Add new contact</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Contact Form (Drawer-style expansion) */}
                  <AnimatePresence>
                    {showAddContact && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border border-[#e2bfb5] bg-white rounded-xl p-4 space-y-4 shadow-sm"
                      >
                        <div className="flex justify-between items-center">
                          <h3 className="text-[14px] font-bold text-[#261814]">
                            New Contact
                          </h3>
                          <button
                            onClick={() => setShowAddContact(false)}
                            className="text-[#5a413a] hover:text-[#ac2d00]"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Name"
                            value={newContactName}
                            onChange={(e) => setNewContactName(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] text-[14px] outline-none"
                          />
                          <input
                            type="tel"
                            placeholder="Phone Number (e.g. +1...)"
                            value={newContactPhone}
                            onChange={(e) => setNewContactPhone(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] text-[14px] outline-none"
                          />
                          {addContactError && (
                            <div className="text-[12px] font-bold text-[#ba1a1a] bg-[#ffdad6]/40 p-2.5 rounded-lg text-left leading-tight">
                              {addContactError}
                            </div>
                          )}
                          <button
                            onClick={handleAddNewContact}
                            className="w-full h-10 bg-[#ac2d00] text-white text-[14px] font-semibold rounded-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform"
                          >
                            Save Contact
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Session Notes */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[12px] font-semibold tracking-wider text-[#5a413a] uppercase">
                      Session Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Meeting at the red cafe near the entrance. I'm wearing a blue jacket."
                      className="w-full min-h-[120px] p-4 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[15px] outline-none resize-none transition-all"
                    />
                    <p className="text-[11px] text-[#5a413a] italic leading-tight">
                      Notes are only shared with contacts if an alert is triggered.
                    </p>
                  </div>
                </div>
              </motion.section>
            )}

            {currentStep === 3 && (
              <motion.section
                key="step3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-left">
                  <h1 className="text-[28px] font-semibold text-[#261814] tracking-tight leading-tight">
                    Final Review
                  </h1>
                  <p className="text-[16px] text-[#5a413a]">
                    Verify details before starting the anchor.
                  </p>
                </div>

                {/* Review Card */}
                <div className="bg-white border border-[#e2bfb5] rounded-xl p-5 shadow-sm space-y-5 text-left">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-[18px] font-bold text-[#261814]">
                        {title}
                      </h3>
                      <div className="flex items-center gap-1 text-[#5a413a] text-[14px]">
                        <MapPin size={16} className="text-[#ac2d00]" />
                        <span>{location}</span>
                      </div>
                    </div>
                    <span className="bg-[#fde2dc] text-[#ac2d00] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                      Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-[#e2bfb5] pt-4">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold tracking-wider text-[#5a413a] uppercase">
                        PERSON
                      </span>
                      <p className="text-[15px] font-medium text-[#261814]">
                        {personName || "Not specified"}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold tracking-wider text-[#5a413a] uppercase">
                        SCHEDULED
                      </span>
                      <p className="text-[15px] font-medium text-[#261814]">
                        {date === todayStr ? "Today" : date}, {time}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold tracking-wider text-[#5a413a] uppercase">
                        DURATION
                      </span>
                      <p className="text-[15px] font-medium text-[#261814]">
                        {durationMinutes} minutes
                      </p>
                    </div>
                  </div>

                  {/* Trusted Contacts in Review */}
                  <div className="space-y-2 pt-2 border-t border-[#e2bfb5]">
                    <span className="text-[11px] font-semibold tracking-wider text-[#5a413a] uppercase block">
                      TRUSTED CONTACTS ({selectedContactsCount})
                    </span>
                    <div className="flex -space-x-2 overflow-hidden py-1">
                      {contacts
                        .filter((c) => c.selected)
                        .map((c) =>
                          c.avatarUrl ? (
                            <img
                              key={c.id}
                              src={c.avatarUrl}
                              alt={c.name}
                              className="w-10 h-10 rounded-full border-2 border-white object-cover"
                            />
                          ) : (
                            <div
                              key={c.id}
                              className="w-10 h-10 rounded-full border-2 border-white bg-[#ffe9e4] text-[#ac2d00] flex items-center justify-center text-[14px] font-bold"
                            >
                              {c.name[0]}
                            </div>
                          )
                        )}
                    </div>
                  </div>
                </div>

                {/* Map Preview */}
                <div className="h-32 w-full rounded-xl overflow-hidden border border-[#e2bfb5] relative z-0">
                  {lat !== null && lng !== null ? (
                    <MapContainer
                      center={[lat, lng]}
                      zoom={14}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                      zoomControl={false}
                      attributionControl={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker
                        position={[lat, lng]}
                        icon={customIcon}
                      />
                    </MapContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#fff8f6] text-[#5a413a]">
                      <Loader2 className="animate-spin text-[#ac2d00] mb-2" size={24} />
                      <span className="text-[12px] font-semibold animate-pulse">Acquiring current GPS location...</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-[#5a413a] uppercase tracking-wider border border-[#e2bfb5]/50 z-10">
                    PREVIEW LOCATION
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <footer className="px-2 pt-4 space-y-3 w-full">
          {startSessionError && (
            <div className="text-[13px] font-bold text-[#ba1a1a] bg-[#ffdad6]/40 p-3 rounded-lg text-left leading-tight space-y-2">
              <p>{startSessionError}</p>
              {startSessionError.includes("active safety session") && (
                <button
                  type="button"
                  onClick={handleForceEndActiveSession}
                  disabled={isForceEnding || isCreating}
                  className="w-full h-10 mt-1 bg-[#ba1a1a] hover:bg-[#a31515] text-white text-[12px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-sm"
                >
                  {isForceEnding ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Ending Stuck Session...</span>
                    </>
                  ) : (
                    <span>Force-End Active Session</span>
                  )}
                </button>
              )}
            </div>
          )}
          {currentStep < 3 ? (
            <button
              onClick={nextStep}
              disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
              className={`w-full h-12 rounded-lg font-semibold text-[17px] flex items-center justify-center gap-2 transition-all ${
                (currentStep === 1 ? !isStep1Valid : !isStep2Valid)
                  ? "bg-[#e2bfb5] text-white opacity-70 cursor-not-allowed"
                  : "bg-[#ac2d00] text-white active:scale-[0.98] shadow-md shadow-primary/10"
              }`}
            >
              <span>Next Step</span>
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleStartSession}
              disabled={isCreating}
              className={`w-full h-12 text-white font-bold text-[17px] rounded-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20 ${
                isCreating ? "bg-[#e2bfb5] cursor-not-allowed" : "bg-[#E8562A] hover:bg-[#d0451a]"
              }`}
            >
              {isCreating ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>Start Anchor Session</span>
                  <Shield size={18} />
                </>
              )}
            </button>
          )}

          {currentStep > 1 && (
            <button
              onClick={prevStep}
              className="w-full h-12 text-[#5a413a] font-semibold text-[14px] flex items-center justify-center gap-1 hover:bg-[#ffe9e4] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft size={16} />
              <span>Go Back</span>
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
