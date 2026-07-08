export function getFriendlyErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  
  let msg = "";
  if (typeof error === 'string') {
    msg = error;
  } else if (error && typeof error === 'object') {
    msg = error.message || error.error_description || error.statusText || "";
    // If it's a standard Error or has no printable properties, don't stringify empty
    if (!msg && Object.keys(error).length > 0) {
      msg = JSON.stringify(error);
    }
  }

  // Fallback if message is empty or stringified empty object
  if (!msg || msg === "{}" || msg === "({})") {
    return fallback;
  }
  
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network") || msg.includes("504")) {
    return "Unable to connect to the safety server. Please check your internet connection and try again.";
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
