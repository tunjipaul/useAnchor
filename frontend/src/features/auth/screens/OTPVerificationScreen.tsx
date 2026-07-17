import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { handleError } from "../../../lib/errorHelpers";

export default function OTPVerificationScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { phoneNumber?: string } | undefined;
  const phoneNumber = state?.phoneNumber;

  // If we somehow arrived here without a phone number, send back to phone entry
  useEffect(() => {
    if (!phoneNumber) {
      navigate("/auth/continue", { replace: true });
    }
  }, [phoneNumber, navigate]);

  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const signInWithOtp = useAuthStore((state) => state.signInWithOtp);

  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(45);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Focus the first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  function handleOtpChange(value: string, index: number) {
    const cleanValue = value.replace(/\D/g, "").slice(-1); // Only allow single digit
    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    // Auto-focus next input if we entered a digit
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Focus previous input and clear it
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    if (!phoneNumber) return;
    setTimeLeft(45);
    setErrorMsg(null);
    const { error } = await signInWithOtp(phoneNumber);
    if (error) {
      setErrorMsg(handleError(error));
    }
  }

  async function handleVerify() {
    if (!phoneNumber) return;
    const code = otp.join("");
    if (code.length !== 6) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { error, is_new_user } = await verifyOtp(phoneNumber, code);
      if (error) {
        setErrorMsg(handleError(error));
      } else {
        setIsSuccess(true);
        // Navigate to correct page based on onboarding status and is_new_user flag
        setTimeout(() => {
          const profile = useAuthStore.getState().profile;
          if (!is_new_user && profile?.onboarding_completed) {
            navigate("/dashboard");
          } else {
            navigate("/auth/profile-setup");
          }
        }, 1000);
      }
    } catch (err: unknown) {
      setErrorMsg(handleError(err));
    }
  }

  const isVerifyDisabled = otp.some((val) => val === "") || isLoading || isSuccess;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#fff8f6" }}
    >
      {/* Mobile wrapper */}
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8">
        
        {/* Top Navigation */}
        <header className="w-full flex items-center justify-between px-2">
          <button
            onClick={() => navigate("/auth/continue")}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform hover:bg-[#ffe9e4]"
            style={{ color: "#261814" }}
          >
            <ArrowLeft size={20} />
          </button>

          {/* Stepper Dots */}
          <div className="flex gap-1.5 items-center">
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#ffb5a0" }} />
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#ffb5a0" }} />
            <div className="h-1.5 w-12 rounded-full shadow-sm" style={{ backgroundColor: "#ac2d00" }} />
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#f7ddd6" }} />
          </div>

          <div className="w-10" /> {/* Balance spacer */}
        </header>

        {/* Content Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 flex flex-col justify-center px-4 mt-4"
        >
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-[22px] font-semibold leading-[28.6px] mb-2"
              style={{ color: "#261814" }}
            >
              Enter your code
            </h1>
            <p
              className="text-[16px] leading-[25.6px]"
              style={{ color: "#5a413a" }}
            >
              Sent to <span className="font-medium text-[#261814]">{phoneNumber ?? ""}</span>
            </p>
          </div>

          {/* OTP input container */}
          <div className="flex justify-between items-center gap-2 max-w-[340px] mx-auto mb-8">
            {otp.map((value, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={1}
                value={value}
                onChange={(e) => handleOtpChange(e.target.value, idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="w-12 h-16 border rounded-lg text-center font-semibold text-[22px] bg-white transition-all focus:outline-none focus:ring-2 focus:ring-[#ac2d00] focus:border-[#ac2d00]"
                style={{ borderColor: "#E4E2DB", color: "#261814" }}
                disabled={isLoading || isSuccess}
              />
            ))}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-6">
              <p className="text-[14px]" style={{ color: "#ba1a1a" }}>
                {errorMsg}
              </p>
            </div>
          )}

          {/* Contextual Links */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-1.5 text-[14px] leading-5" style={{ color: "#5a413a" }}>
              <Clock size={16} style={{ color: "#5a413a" }} />
              {timeLeft > 0 ? (
                <span>
                  Resend code in{" "}
                  <span className="font-mono font-medium text-[#261814]">
                    0:{timeLeft.toString().padStart(2, "0")}
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-bold text-[#ac2d00] hover:underline"
                >
                  Resend code now
                </button>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => navigate("/auth/continue")}
              className="text-[14px] font-semibold text-[#ac2d00] hover:underline underline-offset-4 active:opacity-75 transition-all"
            >
              Change Phone Number
            </button>
          </div>
        </motion.div>

        {/* Action Button (Sticky Footer) */}
        <div className="w-full px-4 pt-4">
          <button
            onClick={handleVerify}
            disabled={isVerifyDisabled}
            className={`w-full h-[52px] rounded-lg flex items-center justify-center gap-2 font-semibold text-[18px] transition-all duration-200 ${
              isVerifyDisabled
                ? isLoading
                  ? "text-white cursor-not-allowed"
                  : "bg-[#e2bfb5] text-white opacity-70 cursor-not-allowed"
                : isSuccess
                ? "bg-[#007caf] text-white"
                : "text-white active:scale-[0.98]"
            }`}
            style={{
              backgroundColor: isVerifyDisabled && !isLoading ? undefined : isSuccess ? undefined : "#ac2d00",
              boxShadow: isVerifyDisabled && !isLoading ? undefined : isSuccess ? undefined : "0 4px 16px rgba(172, 45, 0, 0.25)",
            }}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : isSuccess ? (
              <>
                <CheckCircle2 size={20} />
                <span>Verified!</span>
              </>
            ) : (
              <span>Verify</span>
            )}
          </button>
        </div>

      </main>
    </div>
  );
}
