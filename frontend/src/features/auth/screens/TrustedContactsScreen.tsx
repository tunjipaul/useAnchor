import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, Import, Info, X, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../stores/useAuthStore";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getFriendlyErrorMessage } from "../../../lib/errorHelpers";

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

export default function TrustedContactsScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Auto-lookup name by phone number
  useEffect(() => {
    async function lookupPhone() {
      if (!newPhone.trim()) return;
      const phoneNumberObj = parsePhoneNumberFromString(newPhone.trim());
      if (phoneNumberObj && phoneNumberObj.isValid()) {
        try {
          setIsLookupLoading(true);
          const formattedPhone = encodeURIComponent(phoneNumberObj.number);
          const response = await apiFetch<any>(`/profiles/lookup?phone=${formattedPhone}`);
          if (response.found && response.name) {
            setNewName(response.name);
            triggerToast("Anchor profile found! Name autofilled.");
          }
        } catch (error) {
          // Ignore lookup errors
        } finally {
          setIsLookupLoading(false);
        }
      }
    }
    const timer = setTimeout(lookupPhone, 500);
    return () => clearTimeout(timer);
  }, [newPhone]);

  // Fetch trusted contacts from database on mount
  useEffect(() => {
    async function fetchContacts() {
      if (!user) return;
      setIsLoading(true);
      try {
        const data = await apiFetch<any[]>("/contacts");
        const formatted: Contact[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone_number,
          avatarUrl: undefined,
        }));
        setContacts(formatted);
      } catch (error) {
        console.error("Failed to fetch contacts", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchContacts();
  }, [user]);

  async function handleRemoveContact(id: string) {
    if (!user) return;
    
    // Perform hard delete for now (user deletes it from circle)
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error(error);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (newName.trim().length < 2 || !newPhone.trim()) {
      setFormError("Name must be at least 2 characters, and phone number is required.");
      return;
    }

    // Validate phone number format
    const phoneNumberObj = parsePhoneNumberFromString(newPhone.trim());
    if (!phoneNumberObj || !phoneNumberObj.isValid()) {
      setFormError("Please enter a valid phone number in international format (e.g. +234...).");
      return;
    }

    const formattedPhone = phoneNumberObj.number; // E.164 format

    setIsLoading(true);
    setFormError("");

    try {
      const data = await apiFetch<any>("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          phone_number: formattedPhone,
        })
      });
      const added: Contact = {
        id: data.id,
        name: data.name,
        phone: data.phone_number,
        avatarUrl: undefined,
      };
      setContacts((prev) => [...prev, added]);
      setNewName("");
      setNewPhone("");
      setShowAddForm(false);
    } catch (error: any) {
      setFormError(getFriendlyErrorMessage(error, "Failed to save contact. Make sure the contact is not already added."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start px-4 overflow-y-auto"
      style={{ backgroundColor: "#fff8f6" }}
    >
      {/* Mobile wrapper */}
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8">
        
        {/* Top Header */}
        <header className="w-full flex items-center justify-between px-2 mb-6">
          <button
            onClick={() => navigate("/auth/profile-setup")}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform hover:bg-[#ffe9e4]"
            style={{ color: "#261814" }}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-[20px] font-bold tracking-tight text-[#ac2d00]">
            Circle Setup
          </span>
          <div className="w-10" />
        </header>

        {/* Content Canvas */}
        <div className="flex-1 flex flex-col justify-start px-2 w-full">
          {/* Progress Indicator */}
          <div className="flex flex-col gap-1 mb-8">
            <div className="flex justify-between items-end">
              <span className="text-[12px] font-semibold text-[#5a413a] uppercase tracking-widest">
                Setup Progress
              </span>
              <span className="text-[12px] font-bold text-[#ac2d00]">Step 4 of 5 (80%)</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f7ddd6" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: "80%", backgroundColor: "#ac2d00" }} />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold leading-tight text-[#261814] mb-2">
              Choose your trusted contacts
            </h1>
            <p className="text-[16px] leading-[22px]" style={{ color: "#5a413a" }}>
              Your trusted contacts will <span className="font-bold text-[#261814]">only</span> be notified if you trigger an SOS or fail to finish a check-in.
            </p>
          </div>

          {/* Bento Grid Actions */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                triggerToast("Importing from device contacts is a native platform feature and will be simulated once mobile container is active. For now, please use 'Add Manually'.");
              }}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-[#e2bfb5] p-4 rounded-xl active:scale-95 transition-transform text-center"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ffe9e4]">
                <Import size={20} style={{ color: "#ac2d00" }} />
              </div>
              <span className="text-[12px] font-bold text-[#261814]">Import Contacts</span>
            </button>

            <button
              onClick={() => setShowAddForm(true)}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-[#e2bfb5] p-4 rounded-xl active:scale-95 transition-transform text-center"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ffe9e4]">
                <UserPlus size={20} style={{ color: "#ac2d00" }} />
              </div>
              <span className="text-[12px] font-bold text-[#261814]">Add Manually</span>
            </button>
          </div>

          {/* Manual Add Form Drawer/Card */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border border-[#e2bfb5] bg-white rounded-xl p-4 mb-6 space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-[14px] font-bold text-[#261814]">New Contact</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-[#5a413a] hover:text-[#ac2d00]">
                    <X size={18} />
                  </button>
                </div>
                {formError && (
                  <p className="text-[12px] text-[#ba1a1a] flex items-center gap-1">
                    <AlertCircle size={14} />
                    {formError}
                  </p>
                )}
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="Phone Number (e.g. +234...)"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full h-10 px-3 pr-10 rounded-lg border border-[#e2bfb5] text-[14px] focus:outline-none focus:border-[#ac2d00]"
                    />
                    {isLookupLoading && (
                      <div className="absolute right-3 top-2.5">
                        <Loader2 className="w-5 h-5 text-[#ac2d00] animate-spin" />
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#e2bfb5] text-[14px] focus:outline-none focus:border-[#ac2d00]"
                  />
                  <button
                    onClick={handleAddContact}
                    className="w-full h-10 bg-[#ac2d00] text-white text-[14px] font-semibold rounded-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform"
                  >
                    Save Contact
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected Contacts List */}
          <div className="space-y-4 w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-[18px] font-semibold text-[#261814]">Your Circle</h2>
              <span className="text-[12px] text-[#5a413a]">{contacts.length} Selected</span>
            </div>

            <div className="space-y-2 w-full">
              <AnimatePresence initial={false}>
                {contacts.map((contact) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
                    className="flex items-center justify-between p-3 bg-white border border-[#e2bfb5] rounded-lg shadow-sm w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#ffe9e4] bg-[#fde2dc] flex items-center justify-center shrink-0">
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#ac2d00] font-bold text-lg">{contact.name[0]}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[16px] font-semibold text-[#261814]">{contact.name}</span>
                        <span className="text-[13px] text-[#5a413a]">{contact.phone}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveContact(contact.id)}
                      className="p-1 rounded-full hover:bg-[#fff1ed] transition-colors"
                      style={{ color: "#8e7068" }}
                    >
                      <X size={18} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {contacts.length === 0 && (
                <div className="p-6 text-center border-2 border-dashed border-[#e2bfb5] rounded-xl text-[#5a413a] text-[14px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2 justify-center py-2">
                      <Loader2 className="animate-spin text-[#ac2d00]" size={20} />
                      <span className="text-[12px] text-[#5a413a]">Loading contacts...</span>
                    </div>
                  ) : (
                    "No contacts added yet. Please add at least one manual contact to proceed."
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Empty State / Reminder note */}
          <div className="mt-6 flex gap-3 p-4 rounded-xl bg-[#fff1ed] border border-dashed border-[#e2bfb5]">
            <Info size={20} className="shrink-0 mt-0.5" style={{ color: "#ac2d00" }} />
            <p className="text-[14px] leading-5" style={{ color: "#5a413a" }}>
              At least one contact is required to start a safety session later. You can always add more from your settings.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="w-full px-2 pt-8 space-y-3">
          <button
            onClick={() => navigate("/auth/permissions")}
            disabled={contacts.length === 0}
            className={`w-full h-[56px] rounded-lg flex items-center justify-center font-semibold text-[18px] transition-all duration-200 ${
              contacts.length === 0
                ? "bg-[#e2bfb5] text-white opacity-70 cursor-not-allowed"
                : "text-white active:scale-[0.98]"
            }`}
            style={{
              backgroundColor: contacts.length === 0 ? undefined : "#ac2d00",
              boxShadow: contacts.length === 0 ? undefined : "0 4px 16px rgba(172, 45, 0, 0.25)",
            }}
          >
            Continue
          </button>
          
          <button
            onClick={() => navigate("/auth/permissions")}
            className="w-full h-[48px] bg-transparent text-[#5a413a] font-semibold text-[14px] flex items-center justify-center rounded-lg hover:bg-[#fff1ed] active:scale-95 transition-transform"
          >
            Skip for now
          </button>
        </div>

      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#261814] text-[#fff8f6] px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 max-w-[90%] w-[340px] text-center justify-center font-semibold text-[13px] border border-[#e2bfb5]/20"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
