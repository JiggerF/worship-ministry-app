// lib/supabase/mockClient.ts
export const mockSupabase = {
    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (email === "0@0.com" && password === "0") {
          if (typeof document !== "undefined") {
            // Set a simple dev cookie so server middleware can detect mock auth
            document.cookie = "dev_auth=1; path=/";
            document.cookie = `dev_email=${encodeURIComponent(email)}; path=/`;
          }
          return { error: null, data: { user: { email } } };
        }
        return { error: { message: "Invalid credentials" }, data: null };
      },
    },
  };