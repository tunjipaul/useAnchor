import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, Camera, ShieldCheck, Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { getFriendlyErrorMessage } from "../../../lib/errorHelpers";

export default function ProfileSetupScreen() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.avatar_url || null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync profile details if they load asynchronously
  useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.avatar_url) setPhotoPreview(profile.avatar_url);
    }
  }, [profile]);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleContinue() {
    if (fullName.trim().length < 2) return;
    setIsLoading(true);
    setErrorMsg(null);

    const { error } = await updateProfile({
      full_name: fullName.trim(),
      avatar_url: photoPreview,
    });
    setIsLoading(false);

    if (error) {
      setErrorMsg(getFriendlyErrorMessage(error, "Failed to update profile. Please try again."));
    } else {
      navigate("/auth/trusted-contacts");
    }
  }

  const isButtonDisabled = fullName.trim().length < 2 || isLoading;

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
            onClick={() => navigate("/auth/verify")}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform hover:bg-[#ffe9e4]"
            style={{ color: "#261814" }}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-[20px] font-bold tracking-tight text-[#ac2d00]">
            useAnchor
          </span>
          <div className="w-10" />
        </header>

        {/* Content Canvas */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col justify-start px-2"
        >
          {/* Progress Indicator */}
          <div className="flex flex-col gap-1 mb-8">
            <div className="flex justify-between items-end">
              <span className="text-[12px] font-semibold text-[#5a413a] uppercase tracking-widest">
                Step 3 of 5
              </span>
              <span className="text-[12px] font-bold text-[#ac2d00]">60%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f7ddd6" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: "60%", backgroundColor: "#ac2d00" }} />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[28px] font-semibold leading-[33.6px] mb-2" style={{ color: "#261814" }}>
              Complete your profile
            </h1>
            <p className="text-[16px] leading-[25.6px]" style={{ color: "#5a413a" }}>
              Tell us a little about yourself.
            </p>
          </div>

          {/* Profile Photo Setup */}
          <div className="flex flex-col items-center mb-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer active:scale-95 transition-transform"
            >
              {/* Circular placeholder or preview */}
              <div
                className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden bg-[#fde2dc]"
                style={{ borderColor: "#8e7068" }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} style={{ color: "#8e7068" }} />
                )}
              </div>
              {/* Camera Overlay */}
              <div
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-sm"
                style={{ backgroundColor: "#ac2d00", borderColor: "#fff8f6" }}
              >
                <Camera size={14} className="text-white" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 text-[12px] font-bold uppercase tracking-tight hover:opacity-75 transition-opacity"
              style={{ color: "#ac2d00" }}
            >
              {photoPreview ? "Change Photo" : "Add Photo"}
            </button>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="full_name" className="text-[12px] font-semibold tracking-wider uppercase ml-1" style={{ color: "#5a413a" }}>
                Full Name
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sarah Mitchell"
                className="w-full h-[56px] px-4 rounded-lg border bg-white text-[16px] outline-none transition-all focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00]"
                style={{ borderColor: "#e2bfb5", color: "#261814" }}
              />
            </div>

            {/* Contextual Note */}
            <div
              className="p-4 rounded-xl border flex gap-3 items-start bg-[#fff1ed]"
              style={{ borderColor: "#e2bfb5" }}
            >
              <ShieldCheck size={20} className="shrink-0 mt-0.5" style={{ color: "#ac2d00" }} />
              <p className="text-[14px] leading-5" style={{ color: "#5a413a" }}>
                Your name will be visible to your emergency contacts when you trigger an alert.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Footer actions */}
        <div className="w-full px-2 pt-8 space-y-4">
          {errorMsg && (
            <p className="text-[14px] leading-5 text-center font-medium" style={{ color: "#ba1a1a" }}>
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleContinue}
            disabled={isButtonDisabled}
            className={`w-full h-12 rounded-lg flex items-center justify-center font-semibold text-[18px] transition-all duration-200 ${
              isButtonDisabled
                ? "bg-[#e2bfb5] text-white opacity-70 cursor-not-allowed"
                : "text-white active:scale-[0.98]"
            }`}
            style={{
              backgroundColor: isButtonDisabled ? undefined : "#ac2d00",
              boxShadow: isButtonDisabled ? undefined : "0 4px 16px rgba(172, 45, 0, 0.25)",
            }}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Continue"
            )}
          </button>
          
          <div className="flex justify-center">
            <button
              onClick={() => navigate("/auth/verify")}
              className="text-[12px] font-semibold hover:text-[#ac2d00] transition-colors py-2 px-4 rounded-full"
              style={{ color: "#5a413a" }}
            >
              Cancel and return to OTP
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
