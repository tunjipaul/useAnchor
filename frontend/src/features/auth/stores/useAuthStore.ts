import { create } from "zustand";
import { apiFetch, ApiError } from "../../../lib/api";
import { getErrorDebugInfo } from "../../../lib/errorHelpers";
import toast from "react-hot-toast";

export interface Profile {
  id: number | string;
  phone: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  fcm_token: string | null;
}

interface AuthState {
  session: { access_token: string } | null;
  user: any | null;
  profile: Profile | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  signInWithOtp: (phone: string) => Promise<{ error: any }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  updateFcmToken: (token: string) => Promise<{ error: any }>;
  logout: () => Promise<{ error: any }>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true });
    
    const token = localStorage.getItem("useanchor_access_token");
    if (!token) {
      set({ session: null, user: null, profile: null, isLoading: false });
      return;
    }

    try {
      const profile = await apiFetch<Profile>("/profiles/me");
      set({ 
        session: { access_token: token }, 
        user: profile, 
        profile, 
        isLoading: false 
      });
    } catch (error) {
      // Token invalid or expired
      localStorage.removeItem("useanchor_access_token");
      set({ session: null, user: null, profile: null, isLoading: false });
    }
  },

  signInWithOtp: async (phone: string) => {
    try {
      console.info("[useAnchor Auth] Sending OTP to", phone);
      const response = await apiFetch<{ message: string; test_otp?: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });

      if (response.test_otp) {
        toast.success(`Test OTP Code: ${response.test_otp}`, {
          duration: 10000,
          icon: "💬",
        });
      }
      return { error: null };
    } catch (error) {
      console.error("[useAnchor Auth] send-otp failed:", getErrorDebugInfo(error), error);
      if (error instanceof ApiError && error.type === "cors") {
        toast.error("CORS blocked — see error below and check browser console", { duration: 8000 });
      }
      return { error };
    }
  },

  verifyOtp: async (phone: string, token: string) => {
    try {
      console.info("[useAnchor Auth] Verifying OTP for", phone);
      const data = await apiFetch<{ access_token: string }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, token }),
      });

      localStorage.setItem("useanchor_access_token", data.access_token);

      const profile = await apiFetch<Profile>("/profiles/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      set({
        session: { access_token: data.access_token },
        user: profile,
        profile,
      });

      return { error: null };
    } catch (error) {
      console.error("[useAnchor Auth] verify-otp failed:", getErrorDebugInfo(error), error);
      return { error };
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    try {
      const updatedProfile = await apiFetch<Profile>("/profiles/me", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      set({ profile: updatedProfile, user: updatedProfile });
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  updateFcmToken: async (token: string) => {
    try {
      await apiFetch("/profiles/fcm-token", {
        method: "POST",
        body: JSON.stringify({ fcm_token: token }),
      });
      set((state) => ({
        profile: state.profile ? { ...state.profile, fcm_token: token } : null,
        user: state.user ? { ...state.user, fcm_token: token } : null,
      }));
      return { error: null };
    } catch (error) {
      console.error("[useAnchor Auth] Failed to update FCM token on server:", error);
      return { error };
    }
  },

  logout: async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("Logout request failed", error);
    } finally {
      localStorage.removeItem("useanchor_access_token");
      set({ session: null, user: null, profile: null });
    }
    return { error: null };
  },
}));
