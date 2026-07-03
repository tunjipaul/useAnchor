import { create } from "zustand";
import { supabase } from "../../../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  signInWithOtp: (phone: string) => Promise<{ error: any }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  logout: () => Promise<{ error: any }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true });
    
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    let profile: Profile | null = null;

    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!error && data) {
        profile = data;
      }
    }

    set({ session, user, profile, isLoading: false });

    // Set up auth subscriber for token refreshes / state changes
    supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      const currentUser = currentSession?.user ?? null;
      let currentProfile: Profile | null = null;

      if (currentUser) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();
        
        if (!error && data) {
          currentProfile = data;
        }
      }

      set({ 
        session: currentSession, 
        user: currentUser, 
        profile: currentProfile, 
        isLoading: false 
      });
    });
  },

  signInWithOtp: async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { error };
  },

  verifyOtp: async (phone: string, token: string) => {
    const { error, data } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    
    if (!error && data.session) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .maybeSingle();
      
      set({ 
        session: data.session, 
        user: data.session.user, 
        profile: profileData ?? null 
      });
    }
    return { error };
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const user = get().user;
    if (!user) return { error: new Error("User not authenticated.") };

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (!error && data) {
      set({ profile: data });
    }
    return { error };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      set({ session: null, user: null, profile: null });
    }
    return { error };
  },
}));
