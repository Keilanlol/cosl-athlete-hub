import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans .env avant le build. Aucun fallback n'est fourni.",
  );
}

export const supabase: SupabaseClient = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@coslbloobiz.local`;
