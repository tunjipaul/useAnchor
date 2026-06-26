import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Anchor } from "lucide-react";

import logo from "../../../assets/useAnchorLogo.png";

/* ------------------------------------------------------------------ */
/*  Slide data                                                         */
/* ------------------------------------------------------------------ */
const slides = [
  {
    icon: "logo" as const,
    title: "Because someone should always know where you are",
    subtitle:
      "useAnchor keeps trusted contacts informed about your safety in real-time.",
  },
  {
    icon: "shield" as const,
    title: "Drop an Anchor before you go",
    subtitle:
      "Set a timer, pick your contacts, and let them know you're heading out.",
  },
  {
    icon: "map" as const,
    title: "Live location sharing, automatically",
    subtitle:
      "Your trusted contacts receive your live location the moment your session starts.",
  },
  {
    icon: "bell" as const,
    title: "Smart alerts when something feels off",
    subtitle:
      "If your timer runs out or you trigger SOS, your contacts are notified instantly.",
  },
  {
    icon: "check" as const,
    title: "You're in full control, always",
    subtitle:
      "End your session anytime. Your data stays private — no tracking when you're not anchored.",
  },
];

/* ------------------------------------------------------------------ */
/*  Slide icon component                                               */
/* ------------------------------------------------------------------ */
function SlideIcon({ type }: { type: (typeof slides)[number]["icon"] }) {
  if (type === "logo") {
    return (
      <img
        src={logo}
        alt="useAnchor logo"
        className="w-32 h-32 object-contain"
      />
    );
  }

  // For other slides, use a styled Anchor icon with varying accent
  const iconMap: Record<string, { rotate: string; color: string }> = {
    shield: { rotate: "-12deg", color: "#cf4519" },
    map:    { rotate: "8deg",   color: "#00628c" },
    bell:   { rotate: "-6deg",  color: "#954831" },
    check:  { rotate: "0deg",   color: "#ac2d00" },
  };

  const { rotate, color } = iconMap[type] ?? { rotate: "0deg", color: "#ac2d00" };

  return (
    <div
      className="w-28 h-28 rounded-full flex items-center justify-center"
      style={{
        border: `3px solid ${color}`,
        backgroundColor: `${color}0D`,
      }}
    >
      <Anchor
        size={56}
        strokeWidth={1.8}
        style={{ color, transform: `rotate(${rotate})` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const navigate = useNavigate();

  const isLast = currentSlide === slides.length - 1;

  function goToSlide(index: number) {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }

  function handleNext() {
    if (isLast) {
      navigate("/auth/phone");
      return;
    }
    setDirection(1);
    setCurrentSlide((prev) => prev + 1);
  }

  const slide = slides[currentSlide];

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#fff8f6" }}
    >
      {/* Mobile wrapper */}
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col items-center justify-between py-8">
        {/* Slide content area */}
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full px-4 relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="flex flex-col items-center gap-8"
            >
              {/* Icon */}
              <div className="mt-8 mb-2">
                <SlideIcon type={slide.icon} />
              </div>

              {/* Text */}
              <div className="space-y-4 max-w-[320px]">
                <h1
                  className="text-[28px] font-semibold leading-[33.6px]"
                  style={{ color: "#261814" }}
                >
                  {slide.title}
                </h1>
                <p
                  className="text-[16px] leading-[25.6px]"
                  style={{ color: "#5a413a" }}
                >
                  {slide.subtitle}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CTA Button */}
        <div className="w-full px-4 mt-8 mb-6">
          <button
            onClick={handleNext}
            className="w-full py-5 rounded-xl text-[18px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: "#ac2d00",
              boxShadow: "0 4px 16px rgba(172, 45, 0, 0.25)",
            }}
          >
            {isLast ? "Get Started" : "Next"}
          </button>

          {/* Skip on non-last slides */}
          {!isLast && (
            <button
              onClick={() => navigate("/auth/phone")}
              className="w-full mt-3 py-2 text-[14px] font-medium transition-colors duration-200"
              style={{ color: "#8e7068" }}
            >
              Skip
            </button>
          )}
        </div>

        {/* Dot pagination */}
        <div className="flex items-center gap-2 pb-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentSlide ? 24 : 8,
                height: 8,
                backgroundColor:
                  i === currentSlide ? "#ac2d00" : "#e2bfb5",
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
