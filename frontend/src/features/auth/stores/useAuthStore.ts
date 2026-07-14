import { create } from "zustand";
import { apiFetch } from "../../../lib/api";

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
      const response = await apiFetch<{ message: string, test_otp?: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      
      if (response.test_otp) {
        import("react-hot-toast").then(({ default: toast }) => {
          toast.success(`Test OTP Code: ${response.test_otp}`, { 
            duration: 10000,
            icon: '💬'
          });
        });
      }
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  verifyOtp: async (phone: string, token: string) => {
    try {
      const data = await apiFetch<{ access_token: string }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, token }),
      });
      
      localStorage.setItem("useanchor_access_token", data.access_token);
      
      // Fetch profile after login
      const profile = await apiFetch<Profile>("/profiles/me", {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });

      set({ 
        session: { access_token: data.access_token }, 
        user: profile, 
        profile 
      });
      
      return { error: null };
    } catch (error) {
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
