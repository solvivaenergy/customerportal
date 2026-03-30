import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SUPABASE_URL = "https://kzsocvzhbgtfyksrjmvk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6c29jdnpoYmd0Znlrc3JqbXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU1NDUsImV4cCI6MjA4NzgyMTU0NX0.xljKtxMq3lDpbXol8hYVPmK9NrAGaDSx1MZlJXAUydE";

const webStorage =
  Platform.OS === "web" && typeof window !== "undefined"
    ? {
        getItem: async (key: string) => window.localStorage.getItem(key),
        setItem: async (key: string, value: string) => {
          window.localStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          window.localStorage.removeItem(key);
        },
      }
    : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: webStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
