import { ApiError } from "./api";

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  if (error instanceof ApiError) {
    switch (error.type) {
      case "cors":
        return [
          error.message,
          `Tip: ensure backend ALLOWED_ORIGINS includes "${window.location.origin}" and VITE_API_URL is correct.`,
        ].join(" ");
      case "network":
        return error.message;
      case "http":
        return error.message || fallback;
      case "parse":
        return error.message;
      default:
        return error.message || fallback;
    }
  }

  let msg = "";
  if (typeof error === "string") {
    msg = error;
  } else if (error && typeof error === "object") {
    const err = error as { message?: string; error_description?: string; statusText?: string };
    msg = err.message || err.error_description || err.statusText || "";
    if (!msg && Object.keys(error).length > 0) {
      msg = JSON.stringify(error);
    }
  }

  if (!msg || msg === "{}" || msg === "({})") {
    return fallback;
  }

  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Network request failed")
  ) {
    return `Cannot reach the API server. ${msg} — check VITE_API_URL and that backend2 is running.`;
  }

  if (msg.toLowerCase().includes("cors")) {
    return `CORS error: ${msg}. Add "${window.location.origin}" to backend ALLOWED_ORIGINS.`;
  }

  if (msg.includes("OTP") || msg.includes("token") || msg.includes("code")) {
    if (msg.includes("expired")) {
      return "This verification code has expired. Please request a new one.";
    }
    return "Invalid verification code. Please check the code and try again.";
  }

  if (msg.includes("phone") || msg.includes("format") || msg.includes("chk_phone_e164")) {
    return "Please enter a valid phone number including country code (e.g. +234... or +1...).";
  }

  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429")) {
    return "Too many requests. Please wait a minute before trying again.";
  }

  if (msg.includes("already exists") || msg.includes("duplicate")) {
    if (msg.includes("uq_active_session_per_user")) {
      return "You already have an active safety session in progress. Please complete or end your current session before starting a new one.";
    }
    if (msg.includes("trusted_contacts") || msg.includes("uq_active_user_id_phone")) {
      return "This contact is already in your trusted circle.";
    }
    if (msg.includes("profiles") || msg.includes("phone")) {
      return "This phone number is already registered to an account.";
    }
    return "This record already exists.";
  }

  return msg;
}

/** Full technical detail for console / dev UI */
export function getErrorDebugInfo(error: unknown): string {
  if (error instanceof ApiError) {
    const parts = [
      `[${error.type.toUpperCase()}]`,
      error.message,
      error.status ? `status=${error.status}` : null,
      `url=${error.url}`,
    ].filter(Boolean);
    return parts.join(" | ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
