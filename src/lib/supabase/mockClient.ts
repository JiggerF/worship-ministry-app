// lib/supabase/mockClient.ts
import { INITIAL_MEMBERS, DEV_ADMIN } from "@/lib/mocks/mockPeople";

const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD || DEV_ADMIN.password || "dev";

export const mockSupabase = {
  auth: {
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      // Accept any existing mock member's email with the shared dev password,
      // or accept the explicit DEV_ADMIN credentials.
      const emailLower = String(email).toLowerCase();
      const memberExists = INITIAL_MEMBERS.some((m) => m.email.toLowerCase() === emailLower);
      const isDevAdmin = emailLower === DEV_ADMIN.email.toLowerCase();

      if ((memberExists || isDevAdmin) && password === DEV_PASSWORD) {
        if (typeof document !== "undefined") {
          document.cookie = "dev_auth=1; path=/";
          document.cookie = `dev_email=${encodeURIComponent(email)}; path=/`;
        }
        return { error: null, data: { user: { email } } };
      }

      return { error: { message: "Invalid credentials" }, data: null };
    },
  },
};