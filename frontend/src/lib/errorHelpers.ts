export function getFriendlyErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  
  const msg = typeof error === 'string' 
    ? error 
    : (error.message || error.error_description || JSON.stringify(error));
    
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network")) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
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
    return "This record already exists in your safety circle.";
  }
  
  return msg || fallback;
}
