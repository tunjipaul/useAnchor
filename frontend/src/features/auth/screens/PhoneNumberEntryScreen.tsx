import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Loader2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useAuthStore } from "../stores/useAuthStore";
import { handleError } from "../../../lib/errorHelpers";

export default function PhoneNumberEntryScreen() {
  const navigate = useNavigate();
  const signInWithOtp = useAuthStore((state) => state.signInWithOtp);
  const [phoneNumber, setPhoneNumber] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoginMode = window.location.pathname === "/auth/login";
  const mode = isLoginMode ? "login" : "signup";

  // Validate the phone number using libphonenumber-js
  const phoneNumberObj = phoneNumber ? parsePhoneNumberFromString(phoneNumber) : null;
  const isValid = phoneNumberObj ? phoneNumberObj.isValid() : false;
  
  // Show error only if there is a value, it contains some digits, and is invalid
  const hasDigits = phoneNumberObj ? phoneNumberObj.nationalNumber.length > 0 : false;
  const showError = !!(phoneNumber && hasDigits && !isValid);

  const isButtonDisabled = !isValid || isLoading;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!isValid || !phoneNumber) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await signInWithOtp(phoneNumber);
      if (error) {
        setErrorMsg(handleError(error));
      } else {
        navigate("/auth/verify", { state: { phoneNumber, mode } });
      }
    } catch (err: unknown) {
      setErrorMsg(handleError(err));
    } finally {
      setIsLoading(false);
    }
  }

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
            onClick={() => navigate("/")}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform hover:bg-[#ffe9e4]"
            style={{ color: "#261814" }}
          >
            <ArrowLeft size={20} />
          </button>

          {/* Stepper Dots */}
          <div className="flex gap-1.5">
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#ac2d00" }} />
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#ac2d00" }} />
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#e2bfb5" }} />
            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: "#e2bfb5" }} />
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
              className="text-[28px] font-semibold leading-[33.6px] mb-2"
              style={{ color: "#261814" }}
            >
              {isLoginMode ? "Welcome back!" : "What's your number?"}
            </h1>
            <p
              className="text-[16px] leading-[25.6px]"
              style={{ color: "#5a413a" }}
            >
              {isLoginMode ? "Enter your phone number to log in." : "We'll send you a one-time code to verify your identity."}
            </p>
          </div>

          {/* Input Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <PhoneInput
              defaultCountry="NG"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="Enter phone number"
              autoFocus
              className="flex h-[56px] w-full border rounded-lg bg-white overflow-hidden transition-all focus-within:ring-2 focus-within:ring-[#ac2d00]"
              style={{ borderColor: "#E4E2DB" }}
              disabled={isLoading}
            />

            {/* Validation Message */}
            {showError && (
              <p className="text-[14px] leading-5 px-1 font-medium" style={{ color: "#ba1a1a" }}>
                Please enter a valid phone number.
              </p>
            )}

            {/* API Error Message */}
            {errorMsg && (
              <p className="text-[14px] leading-5 px-1 font-medium" style={{ color: "#ba1a1a" }}>
                {errorMsg}
              </p>
            )}

            {/* Privacy Note */}
            <div className="flex items-start gap-2 px-1 pt-2">
              <Lock size={16} className="mt-0.5" style={{ color: "#5a413a" }} />
              <p className="text-[14px] leading-5" style={{ color: "#5a413a" }}>
                We never share your number with anyone.
              </p>
            </div>

            {/* Hidden submit button to allow Enter submission */}
            <button type="submit" className="hidden" />
          </form>
        </motion.div>

        {/* Action Section (Pushed to bottom) */}
        <div className="w-full px-4 pt-4">
          <button
            onClick={handleSubmit}
            disabled={isButtonDisabled}
            className={`w-full h-[52px] rounded-lg flex items-center justify-center gap-2 font-semibold text-[18px] transition-all duration-200 ${
              isButtonDisabled
                ? isLoading
                  ? "text-white cursor-not-allowed"
                  : "bg-[#e2bfb5] text-white opacity-70 cursor-not-allowed"
                : "text-white active:scale-[0.98]"
            }`}
            style={{
              backgroundColor: isButtonDisabled && !isLoading ? undefined : "#ac2d00",
              boxShadow: isButtonDisabled && !isLoading ? undefined : "0 4px 16px rgba(172, 45, 0, 0.25)",
            }}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>Send Code</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>

          {/* Contextual Help */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-[14px] leading-5 text-center" style={{ color: "#5a413a" }}>
              {isLoginMode ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/auth/signup")}
                    className="underline font-semibold hover:text-[#ac2d00]"
                    style={{ color: "#ac2d00" }}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/auth/login")}
                    className="underline font-semibold hover:text-[#ac2d00]"
                    style={{ color: "#ac2d00" }}
                  >
                    Log In
                  </button>
                </>
              )}
            </p>

            <p className="text-center text-[12px] leading-4" style={{ color: "#8e7068" }}>
              By tapping "Send Code", you agree to our{" "}
              <a href="#" className="underline hover:text-[#ac2d00]" style={{ color: "#ac2d00" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="underline hover:text-[#ac2d00]" style={{ color: "#ac2d00" }}>
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
