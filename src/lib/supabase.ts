import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(
  url && anonKey && /^https?:\/\//.test(url),
);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants ou invalides. Crée un fichier .env (voir .env.example) puis relance le build.",
  );
}

// Fallback URL valide pour éviter que createClient throw et casse tout le rendu.
// Aucune requête ne sera émise tant que supabaseConfigured === false (gardé côté UI).
export const supabase: SupabaseClient = createClient(
  supabaseConfigured ? (url as string) : "http://localhost:54321",
  supabaseConfigured ? (anonKey as string) : "anon-placeholder",
  {
    auth: {
      persistSession: supabaseConfigured,
      autoRefreshToken: supabaseConfigured,
      detectSessionInUrl: false,
    },
  },
);

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@coslbloobiz.local`;
