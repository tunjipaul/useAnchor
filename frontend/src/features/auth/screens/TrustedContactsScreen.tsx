import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, Import, Info, X, AlertCircle } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

export default function TrustedContactsScreen() {
  const navigate = useNavigate();

  // Load template defaults
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: "1",
      name: "Sarah Mitchell",
      phone: "+1 (555) 012-3456",
      avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAQePpUuBKwsoub5UBM_f81LVXERpegGnurfyiwa1elkHVPVs9q9ht5Lqk4qzVhBh4kpRadhlvsMYUexMSMTwLFw9FLBSJilA6pVd2kUzoqGN1D3KVQobFJ73ckSAVuCelVU2h7VEdD9rEysjmx548z9EzCOIlJVo799cZYw6jBY2sbbvgsZv2yI7O-p8EmPZLl9TfQtZ7TaLeGcyNllKu3r0TSySIzo1st-XtzxQmnzIZnZhGz1775UuGes-3p-_-Kz_3UkNYeJVk"
    },
    {
      id: "2",
      name: "David Chen",
      phone: "+1 (555) 987-6543",
      avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAYKURgJMeHyiYcj_YLmLkWusAuXDy3agl0nncAeOipm54bxbulLrsGq3NK_aRM70XKSa4MHuPZwoh-8Fat_iRpqMuLj3gCVA3JPAPO6nLKtiwdS8SwNs1N1LuJf8jbUTVzOBxWnCFVke4AmG0dMx6uSZXZSqnRIgfen77BPd0T_wzWZU1vQPCYLhBsqHC9-JsAntZoIEJPkLmzAPr1lYHY0pxkiuqbpMveKuICT9ReNrD5TS0A3HiNc9x0zihr6TgU_ycZrUMt9fM"
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState("");

  function handleRemoveContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      setFormError("Both name and phone number are required.");
      return;
    }
    const newContact: Contact = {
      id: Math.random().toString(),
      name: newName.trim(),
      phone: newPhone.trim()
    };
    setContacts((prev) => [...prev, newContact]);
    setNewName("");
    setNewPhone("");
    setFormError("");
    setShowAddForm(false);
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
                // Mock import alert
                alert("Importing from device contacts is a native platform feature and will be simulated once mobile container is active. For now, please use 'Add Manually'.");
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
                  <input
                    type="text"
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#e2bfb5] text-[14px] focus:outline-none focus:border-[#ac2d00]"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number (e.g. +234...)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
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
                  No contacts added yet. Please add at least one manual contact to proceed.
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
    </div>
  );
}
