import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, UserPlus, Search, MoreVertical, Plus, X,
  Home, Activity, Users, Settings, Siren, Bell, Info,
  Edit2, Trash2, MapPin, EyeOff,
} from "lucide-react";
import MobileBottomNav from "../../../components/MobileBottomNav";
import DesktopHeader from "../../../components/DesktopHeader";
import DesktopSidebar from "../../../components/DesktopSidebar";

type RelationshipTag = "Family" | "Friend" | "Colleague" | "Work" | null;

// Hardcoded initial contacts
const initialContacts = [
  {
    id: "1",
    firstName: "Albert",
    lastName: "Thompson",
    phone: "+1 (555) 012-3456",
    tag: "Family" as RelationshipTag,
    isPrimary: true,
    status: "active" as const,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDOSgdEP21gMIHb-xdNYa1ALTCC7JZ_HRORNajbQKgT4f08i9bvaz9A167W-dh5RAT10iWZIoXWij0oFHbU8a-wGI11F_KX9Fk17VozhtbRsLar3UIgE_Fa5GpjdDtRkPnwA_tT51wbCVT-sKo0mYRLa2YY5mvy-HziBVCEK_SMAhKX9kH7VwAHqLF3lTeWJPbKLYsZxjmvH8kXdlERx6TXwoQ-XZi4xuabZq2QITpZEAoIaWY87RaZB6iO2xWOVdsjoGvBzgl-IqQ",
  },
  {
    id: "2",
    firstName: "Amanda",
    lastName: "Lee",
    phone: "+1 (555) 012-7890",
    tag: "Work" as RelationshipTag,
    isPrimary: false,
    status: "disabled" as const,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4RULsH1j5KU8BQSxEmtAR1czT5ei-2vyNSGUuZizt8ra5sGXL1luUGesHFIlgMqEO0iF5c6PN4qFOoLvnNYf46aQ0-O8hq5z3UkxJwdPFUiKVQZzosuunx6kkEkkT4JEJsw-bZgOHsMr3XvEW5jZE5RCkM0fUa8KjxdOo2fdowiKXHAcPW13aXIYcsNZ3zL-5-XtOp3ge6lkp3S24y1pxlWsTNPLc28jAerZVvKz7Pj5zNUQ4jywdXbixctNpTFtZQb9n4F0x6SQ",
  },
  {
    id: "3",
    firstName: "Marcus",
    lastName: "Chen",
    phone: "+1 (555) 019-2233",
    tag: "Friend" as RelationshipTag,
    isPrimary: false,
    status: "active" as const,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD3MYDyL6M5GtrFBRnNC-y1dVgVCOEOQdDPzis04e25Encbf5mh01xrxNNa-sUDp8zeFuJTlYP5rc7ON-wGdX-xI1i42JDWZzdQJPqRJtiq6IwZHmSoPrCx0OjaAsQaTrBFgPsiS9BPGLWiDs8Kg_ls9LKFhmIaDcY0grXXErJbFPwA5RI0d7Efmp8UuqS3W7oYdBh5qLO7juIXvdskO2aL1NaeMmGZPUUe-gGMKM0dTcmi-insVjJkCVovl95nifIozSiWnUDrmj8",
  },
  {
    id: "4",
    firstName: "Sarah",
    lastName: "Jenkins",
    phone: "+1 (555) 014-4455",
    tag: "Family" as RelationshipTag,
    isPrimary: false,
    status: "active" as const,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBXJeud92R6pTwdWSDy3JFjo3dJ7hwV1acRbCRUZnRJkJAe7ObIWwCQzrWVi8Uv2q7zhCe4SLRiSFI5o82NdxBmnARVLyraNBWnwSZrKYeQX6aNZIGYRUhJumenOF4VkSBLjHhGE_OBYkXHlGucZrm40fpg8N0b2SGBEf7zb1qf0cO8aDoTTg0TdsqW8d0jODb01SeL67x4HxML5eKPQ5dk3y-eCArl2KRGNS61P8j_QlBPFldz0AfNRyYgsGnWfCV_4vNZNFsFCAg",
  },
];

export default function ContactsManagerScreen() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState(initialContacts);
  const [searchQuery, setSearchQuery] = useState("");

  // Mobile modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Desktop drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("Add New Contact");
  const [drawerFullName, setDrawerFullName] = useState("");
  const [drawerPhone, setDrawerPhone] = useState("");
  const [drawerTag, setDrawerTag] = useState<RelationshipTag>(null);
  const [drawerIsPrimary, setDrawerIsPrimary] = useState(false);

  const handleDeleteContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id));
    setActiveDropdown(null);
  };

  const handleAddContactClick = async () => {
    if ("contacts" in navigator && "ContactsManager" in window) {
      try {
        const props = ["name", "tel"];
        const opts = { multiple: false };
        const supported = await (navigator as any).contacts.select(props, opts);
        if (supported && supported.length > 0) {
          const contact = supported[0];
          const nameParts = contact.name?.[0]?.split(" ") || ["Unknown"];
          setContacts([
            ...contacts,
            {
              id: Date.now().toString(),
              firstName: nameParts[0],
              lastName: nameParts.slice(1).join(" "),
              phone: contact.tel?.[0] || "",
              tag: null,
              isPrimary: false,
              status: "active" as const,
              avatar: "https://via.placeholder.com/150",
            },
          ]);
          return;
        }
      } catch {
        /* fall through */
      }
    }
    setIsModalOpen(true);
  };

  const handleSaveManualContact = () => {
    if (!newFirstName.trim() || !newPhone.trim()) return;
    setContacts([
      ...contacts,
      {
        id: Date.now().toString(),
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim(),
        tag: null,
        isPrimary: false,
        status: "active" as const,
        avatar: "https://via.placeholder.com/150",
      },
    ]);
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setIsModalOpen(false);
  };

  const openDrawerForAdd = () => {
    setDrawerTitle("Add New Contact");
    setDrawerFullName("");
    setDrawerPhone("");
    setDrawerTag(null);
    setDrawerIsPrimary(false);
    setIsDrawerOpen(true);
  };

  const openDrawerForEdit = (name: string) => {
    setDrawerTitle(`Edit ${name}`);
    setDrawerFullName(name);
    setIsDrawerOpen(true);
  };

  const handleSaveDrawerContact = () => {
    if (!drawerFullName.trim() || !drawerPhone.trim()) return;
    const parts = drawerFullName.trim().split(" ");
    setContacts([
      ...contacts,
      {
        id: Date.now().toString(),
        firstName: parts[0],
        lastName: parts.slice(1).join(" "),
        phone: drawerPhone.trim(),
        tag: drawerTag,
        isPrimary: drawerIsPrimary,
        status: "active" as const,
        avatar: "https://via.placeholder.com/150",
      },
    ]);
    setIsDrawerOpen(false);
  };

  // Mobile: grouped by first letter
  const filteredContacts = contacts.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const letter = contact.firstName.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, typeof initialContacts>);
  const sortedLetters = Object.keys(groupedContacts).sort();

  // Desktop filtered contacts
  const desktopFiltered = contacts.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tagColors: Record<string, string> = {
    Primary: "bg-[#ffdbd1] text-[#3b0900]",
    Family: "bg-[#c8e6ff] text-[#001e2e]",
    Friend: "bg-[#c8e6ff] text-[#001e2e]",
    Work: "bg-[#f7ddd6] text-[#5a413a]",
    Colleague: "bg-[#f7ddd6] text-[#5a413a]",
  };

  return (
    <div className="min-h-screen bg-[#fff8f6] text-[#261814]">

      {/* ============================= */}
      {/*    MOBILE LAYOUT (lg:hidden)  */}
      {/* ============================= */}
      <div className="flex flex-col lg:hidden">
        {/* TopAppBar */}
        <header className="fixed top-0 w-full z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm flex justify-between items-center px-4 h-[64px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffe9e4] active:scale-95 transition-all text-[#ac2d00]"
              aria-label="Go back"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[22px] font-bold text-[#ac2d00] tracking-tight">Trusted Contacts</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddContactClick}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:opacity-80 active:scale-95 transition-all text-[#ac2d00]"
            >
              <UserPlus size={24} />
            </button>
            <div
              onClick={() => navigate("/settings")}
              className="w-8 h-8 rounded-full overflow-hidden border border-[#e2bfb5] bg-[#ffe9e4] cursor-pointer"
            >
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDE-qaqUbues0QP3_CpX_doFGBr6379MEUheKjEltx7apQeEfjMGA4A659vVa0qosViwGjnSWODIVfZlIeq7GPxHSFlSRF4h0xOLw-P7zS211mDZoMLAUd-ACqOWTY9ijw7CzNnMGpwAU3y0mM8pl_eJMLX5LMkVCYJ2R8SqdRB639BiS3MvE8hb6-luGjfGTlYgE34Kh3K3I1YW6AyXIFOJvwd5yfjCLwS2mTlshMNLRUaUu0Ey4wUy7QLlfmpR9v54J7VUpqXZsc"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 pt-[64px] pb-[80px] px-4 overflow-y-auto no-scrollbar max-w-[500px] w-full mx-auto">
          {/* Search */}
          <div className="py-3 sticky top-0 bg-[#fff8f6] z-40">
            <div className="relative flex items-center">
              <Search className="absolute left-3 text-[#5a413a]" size={20} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-3 bg-[#fff8f6] border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] transition-all outline-none"
                placeholder="Search contacts..."
                type="text"
              />
            </div>
          </div>

          {/* Contact List */}
          <div className="mt-2 space-y-3">
            {sortedLetters.length === 0 ? (
              <div className="text-center py-10 text-[#5a413a]">No contacts found.</div>
            ) : (
              sortedLetters.map((letter) => (
                <div key={letter} className="relative">
                  <div className="sticky top-[72px] bg-[#fff8f6]/95 backdrop-blur-sm py-1 font-bold text-[18px] text-[#ac2d00] z-30">
                    {letter}
                  </div>
                  <div className="space-y-2 mt-2">
                    {groupedContacts[letter].map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-[#fff8f6] border border-[#e2bfb5] rounded-lg p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#fde2dc] flex-shrink-0">
                            <img className="w-full h-full object-cover" src={contact.avatar} alt={`${contact.firstName} ${contact.lastName}`} />
                          </div>
                          <div>
                            <p className="font-bold text-[18px] text-[#261814]">
                              {contact.firstName} {contact.lastName}
                            </p>
                            <p className="text-[14px] text-[#5a413a]">{contact.phone}</p>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === contact.id ? null : contact.id)}
                            className="w-10 h-10 flex items-center justify-center text-[#5a413a] hover:bg-[#ffe9e4] rounded-full transition-colors"
                          >
                            <MoreVertical size={20} />
                          </button>
                          {activeDropdown === contact.id && (
                            <div className="absolute right-0 top-10 mt-1 w-32 bg-white rounded-lg shadow-lg border border-[#e2bfb5] z-50 overflow-hidden">
                              <button
                                onClick={() => handleDeleteContact(contact.id)}
                                className="w-full text-left px-4 py-3 text-[#ba1a1a] hover:bg-[#ffdad6] font-bold text-[14px] transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* FAB */}
          <div className="fixed bottom-24 right-4 z-50">
            <button
              onClick={handleAddContactClick}
              className="h-14 px-6 bg-[#ac2d00] text-white font-bold text-[18px] rounded-full shadow-lg flex items-center gap-2 active:scale-95 transition-transform hover:opacity-90"
            >
              <Plus size={24} />
              <span>Add Contact</span>
            </button>
          </div>
        </main>

        {/* Mobile Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#261814]/40 backdrop-blur-sm">
            <div className="w-full max-w-[500px] bg-white rounded-t-2xl shadow-xl flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e2bfb5] flex justify-between items-center bg-[#fff8f6]">
                <h2 className="text-[20px] font-bold text-[#ac2d00]">Add Contact Manually</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#ffe9e4] text-[#ac2d00] hover:opacity-80 transition-opacity"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5a413a] mb-1">First Name <span className="text-[#ac2d00]">*</span></label>
                  <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="e.g. Jane" className="w-full h-12 px-3 border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] outline-none" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5a413a] mb-1">Last Name</label>
                  <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="e.g. Doe" className="w-full h-12 px-3 border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] outline-none" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5a413a] mb-1">Phone Number <span className="text-[#ac2d00]">*</span></label>
                  <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="w-full h-12 px-3 border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] outline-none" />
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-[#5a413a] bg-[#fff8f6] border border-[#e2bfb5] rounded-xl active:scale-[0.98] transition-transform">
                  Cancel
                </button>
                <button onClick={handleSaveManualContact} disabled={!newFirstName.trim() || !newPhone.trim()} className="flex-1 py-3 font-bold text-white bg-[#ac2d00] rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50">
                  Save Contact
                </button>
              </div>
            </div>
          </div>
        )}

        <MobileBottomNav />
      </div>

      {/* ============================== */}
      {/*  DESKTOP LAYOUT (hidden md:flex) */}
      {/* ============================== */}
      <div className="hidden lg:flex flex-col min-h-screen">
        <DesktopHeader />
        <DesktopSidebar />

        {/* Main Content */}
        <main className="ml-64 mt-16 flex-grow min-h-[calc(100vh-64px)] overflow-y-auto bg-[#fff8f6] p-8">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold text-[#261814]">Trusted Contacts</h1>
                <p className="text-[16px] text-[#5a413a]">Manage the circle of people who can track your safety and receive emergency alerts.</p>
              </div>
              <div className="flex gap-3">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a413a]" size={18} />
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#e2bfb5] rounded-lg focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] outline-none transition-all text-[14px]"
                    placeholder="Search contacts..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  onClick={openDrawerForAdd}
                  className="flex items-center gap-2 bg-[#ac2d00] text-white px-5 py-3 rounded-lg font-bold active:scale-95 transition-transform whitespace-nowrap"
                >
                  <UserPlus size={18} />
                  Add Contact
                </button>
              </div>
            </div>

            {/* Contacts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {desktopFiltered.map((contact) => (
                <div
                  key={contact.id}
                  className="group relative bg-white border border-[#e2bfb5] rounded-xl p-6 shadow-sm cursor-pointer hover:border-[#ac2d00] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#fde2dc] group-hover:ring-[#ac2d00]/20 transition-all flex-shrink-0">
                        <img className="w-full h-full object-cover" src={contact.avatar} alt={`${contact.firstName} ${contact.lastName}`} />
                      </div>
                      <div>
                        <h3 className="text-[18px] font-semibold text-[#261814]">{contact.firstName} {contact.lastName}</h3>
                        <p className="text-[13px] text-[#5a413a]">{contact.phone}</p>
                        <div className="mt-1.5 flex gap-1.5 flex-wrap">
                          {contact.isPrimary && (
                            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${tagColors["Primary"]}`}>Primary</span>
                          )}
                          {contact.tag && (
                            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${tagColors[contact.tag] || "bg-[#f7ddd6] text-[#5a413a]"}`}>{contact.tag}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button className="p-1.5 text-[#5a413a] hover:text-[#ac2d00] transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </div>

                  <div className="mt-5 flex justify-between items-center pt-4 border-t border-[#e2bfb5]">
                    <div className="flex items-center gap-1.5 text-[12px] text-[#5a413a]">
                      {contact.status === "active" ? (
                        <>
                          <MapPin size={14} className="text-[#ac2d00]" />
                          <span>Active monitoring</span>
                        </>
                      ) : (
                        <>
                          <EyeOff size={14} className="text-[#5a413a]" />
                          <span>Tracking disabled</span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openDrawerForEdit(`${contact.firstName} ${contact.lastName}`)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#e2bfb5] text-[#5a413a] hover:bg-[#ffe9e4] hover:text-[#ac2d00] transition-all"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#e2bfb5] text-[#5a413a] hover:bg-[#ffdad6] hover:text-[#ba1a1a] transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {desktopFiltered.length === 0 && (
                <div className="col-span-3 text-center py-16 text-[#5a413a]">No contacts found.</div>
              )}
            </div>

            {/* Info Banner */}
            <div className="mt-10 bg-[#007caf] text-white rounded-xl p-5 flex items-start gap-4 border border-[#00628c]">
              <Info size={22} className="flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-[15px] mb-1">How Trusted Contacts Work</h4>
                <p className="text-[13px] opacity-90">Contacts will be notified via SMS if you trigger an SOS. Primary contacts can also request your location if you haven't checked in for more than 4 hours.</p>
              </div>
            </div>
          </div>
        </main>

        {/* Desktop Drawer Overlay */}
        {isDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        {/* Desktop Drawer Panel */}
        <div
          className={`fixed top-0 right-0 h-full w-[420px] bg-[#fff8f6] shadow-2xl z-[101] border-l border-[#e2bfb5] overflow-y-auto transition-transform duration-300 ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[24px] font-semibold text-[#261814]">{drawerTitle}</h2>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-[#5a413a] hover:bg-[#ffe9e4] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="w-24 h-24 rounded-full bg-[#fde2dc] flex items-center justify-center text-[#ac2d00] border-2 border-dashed border-[#e2bfb5] hover:border-[#ac2d00] cursor-pointer transition-all">
                  <UserPlus size={36} />
                </div>
                <span className="text-[12px] text-[#5a413a]">Upload contact photo</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-[#261814] uppercase tracking-wider">Full Name</label>
                <input
                  className="w-full px-4 py-3 border border-[#e2bfb5] rounded-lg focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] outline-none transition-all text-[14px]"
                  placeholder="e.g. Sarah Miller"
                  type="text"
                  value={drawerFullName}
                  onChange={(e) => setDrawerFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-[#261814] uppercase tracking-wider">Phone Number</label>
                <div className="flex gap-2">
                  <div className="w-16 px-2 py-3 border border-[#e2bfb5] rounded-lg bg-[#fff1ed] text-center text-[14px] text-[#5a413a]">+1</div>
                  <input
                    className="flex-grow px-4 py-3 border border-[#e2bfb5] rounded-lg focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] outline-none transition-all text-[14px]"
                    placeholder="(555) 000-0000"
                    type="tel"
                    value={drawerPhone}
                    onChange={(e) => setDrawerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-[#261814] uppercase tracking-wider">Relationship Tag</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Family", "Friend", "Colleague"] as RelationshipTag[]).map((tag) => (
                    <button
                      key={tag!}
                      type="button"
                      onClick={() => setDrawerTag(drawerTag === tag ? null : tag)}
                      className={`px-2 py-2 border rounded-lg text-[14px] transition-all ${
                        drawerTag === tag
                          ? "border-[#ac2d00] bg-[#ffdbd1] text-[#ac2d00] font-bold"
                          : "border-[#e2bfb5] hover:border-[#ac2d00] hover:bg-[#ffdbd1]"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-4 border border-[#e2bfb5] rounded-xl bg-white">
                  <div>
                    <p className="font-bold text-[15px] text-[#261814]">Primary Contact</p>
                    <p className="text-[12px] text-[#5a413a]">Receive priority alerts first</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawerIsPrimary}
                      onChange={(e) => setDrawerIsPrimary(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#e2bfb5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 py-3 border border-[#e2bfb5] rounded-lg font-bold text-[#5a413a] hover:bg-[#fff1ed] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDrawerContact}
                  className="flex-1 py-3 bg-[#ac2d00] text-white rounded-lg font-bold shadow-lg hover:bg-[#8a2400] active:scale-95 transition-all"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
