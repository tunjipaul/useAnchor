import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, UserPlus, Search, MoreVertical, Plus, X } from "lucide-react";
import MobileBottomNav from "../../../components/MobileBottomNav";

// Hardcoded initial contacts based on the UI design
const initialContacts = [
  {
    id: "1",
    firstName: "Albert",
    lastName: "Thompson",
    phone: "+1 (555) 012-3456",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDOSgdEP21gMIHb-xdNYa1ALTCC7JZ_HRORNajbQKgT4f08i9bvaz9A167W-dh5RAT10iWZIoXWij0oFHbU8a-wGI11F_KX9Fk17VozhtbRsLar3UIgE_Fa5GpjdDtRkPnwA_tT51wbCVT-sKo0mYRLa2YY5mvy-HziBVCEK_SMAhKX9kH7VwAHqLF3lTeWJPbKLYsZxjmvH8kXdlERx6TXwoQ-XZi4xuabZq2QITpZEAoIaWY87RaZB6iO2xWOVdsjoGvBzgl-IqQ",
  },
  {
    id: "2",
    firstName: "Amanda",
    lastName: "Lee",
    phone: "+1 (555) 012-7890",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4RULsH1j5KU8BQSxEmtAR1czT5ei-2vyNSGUuZizt8ra5sGXL1luUGesHFIlgMqEO0iF5c6PN4qFOoLvnNYf46aQ0-O8hq5z3UkxJwdPFUiKVQZzosuunx6kkEkkT4JEJsw-bZgOHsMr3XvEW5jZE5RCkM0fUa8KjxdOo2fdowiKXHAcPW13aXIYcsNZ3zL-5-XtOp3ge6lkp3S24y1pxlWsTNPLc28jAerZVvKz7Pj5zNUQ4jywdXbixctNpTFtZQb9n4F0x6SQ",
  },
  {
    id: "3",
    firstName: "Marcus",
    lastName: "Chen",
    phone: "+1 (555) 019-2233",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD3MYDyL6M5GtrFBRnNC-y1dVgVCOEOQdDPzis04e25Encbf5mh01xrxNNa-sUDp8zeFuJTlYP5rc7ON-wGdX-xI1i42JDWZzdQJPqRJtiq6IwZHmSoPrCx0OjaAsQaTrBFgPsiS9BPGLWiDs8Kg_ls9LKFhmIaDcY0grXXErJbFPwA5RI0d7Efmp8UuqS3W7oYdBh5qLO7juIXvdskO2aL1NaeMmGZPUUe-gGMKM0dTcmi-insVjJkCVovl95nifIozSiWnUDrmj8",
  },
  {
    id: "4",
    firstName: "Sarah",
    lastName: "Jenkins",
    phone: "+1 (555) 014-4455",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBXJeud92R6pTwdWSDy3JFjo3dJ7hwV1acRbCRUZnRJkJAe7ObIWwCQzrWVi8Uv2q7zhCe4SLRiSFI5o82NdxBmnARVLyraNBWnwSZrKYeQX6aNZIGYRUhJumenOF4VkSBLjHhGE_OBYkXHlGucZrm40fpg8N0b2SGBEf7zb1qf0cO8aDoTTg0TdsqW8d0jODb01SeL67x4HxML5eKPQ5dk3y-eCArl2KRGNS61P8j_QlBPFldz0AfNRyYgsGnWfCV_4vNZNFsFCAg",
  },
];

export default function ContactsManagerScreen() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState(initialContacts);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleDeleteContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
    setActiveDropdown(null);
  };

  const handleAddContactClick = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        const supported = await (navigator as any).contacts.select(props, opts);
        
        if (supported && supported.length > 0) {
          const contact = supported[0];
          const nameParts = contact.name?.[0]?.split(" ") || ["Unknown"];
          const fName = nameParts[0];
          const lName = nameParts.slice(1).join(" ");
          
          const newContact = {
            id: Date.now().toString(),
            firstName: fName,
            lastName: lName,
            phone: contact.tel?.[0] || "",
            avatar: "https://via.placeholder.com/150",
          };
          setContacts([...contacts, newContact]);
        }
      } catch (err) {
        // Fallback to manual if picker fails or is dismissed
        setIsModalOpen(true);
      }
    } else {
      // Fallback for iOS/Desktop
      setIsModalOpen(true);
    }
  };

  const handleSaveManualContact = () => {
    if (!newFirstName.trim() || !newPhone.trim()) return;

    const newContact = {
      id: Date.now().toString(),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      phone: newPhone.trim(),
      avatar: "https://via.placeholder.com/150",
    };
    
    setContacts([...contacts, newContact]);
    
    // Reset and close
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setIsModalOpen(false);
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Group contacts by first letter
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const letter = contact.firstName.charAt(0).toUpperCase();
    if (!acc[letter]) {
      acc[letter] = [];
    }
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, typeof initialContacts>);

  // Sort groups alphabetically
  const sortedLetters = Object.keys(groupedContacts).sort();

  return (
    <div className="min-h-screen flex flex-col bg-[#fff8f6] text-[#261814]">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm flex justify-between items-center px-4 h-[64px]">
        <div className="flex items-center gap-3">
          <Shield className="text-[#ac2d00]" size={24} />
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

      {/* Main Content */}
      <main className="flex-1 pt-[64px] pb-[80px] px-4 overflow-y-auto no-scrollbar max-w-[500px] w-full mx-auto">
        {/* Search Section */}
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

        {/* FAB for Adding Contact */}
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

      {/* Manual Entry Fallback Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#261814]/40 backdrop-blur-sm">
          <div className="w-full max-w-[500px] bg-white rounded-t-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e2bfb5] flex justify-between items-center bg-[#fff8f6]">
              <h2 className="text-[20px] font-bold text-[#ac2d00]">Add Contact Manually</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#ffe9e4] text-[#ac2d00] hover:opacity-80 transition-opacity"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5a413a] mb-1">First Name <span className="text-[#ac2d00]">*</span></label>
                <input 
                  type="text" 
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="e.g. Jane"
                  className="w-full h-12 px-3 border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5a413a] mb-1">Last Name</label>
                <input 
                  type="text" 
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="e.g. Doe"
                  className="w-full h-12 px-3 border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5a413a] mb-1">Phone Number <span className="text-[#ac2d00]">*</span></label>
                <input 
                  type="tel" 
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full h-12 px-3 border border-[#e2bfb5] rounded-lg focus:ring-1 focus:ring-[#ac2d00] focus:border-[#ac2d00] outline-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0 flex gap-3 mt-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 font-bold text-[#5a413a] bg-[#fff8f6] border border-[#e2bfb5] rounded-xl active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveManualContact}
                disabled={!newFirstName.trim() || !newPhone.trim()}
                className="flex-1 py-3 font-bold text-white bg-[#ac2d00] rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
              >
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
