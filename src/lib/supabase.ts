import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configErrorMessage =
  "Configuration Supabase manquante ou invalide. Vérifie VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";

export const supabaseConfigured = Boolean(
  url && anonKey && /^https?:\/\//.test(url),
);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    `[supabase] ${configErrorMessage} Crée un fichier .env (voir .env.example) puis relance le build.`,
  );
}

const createDisabledSupabaseClient = (): SupabaseClient => {
  const authError = {
    name: "AuthError",
    message: configErrorMessage,
    status: 500,
  };

  return {
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: authError }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: authError,
      }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
};

const createSupabaseClient = (): SupabaseClient => {
  if (!supabaseConfigured) return createDisabledSupabaseClient();

  try {
    return createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        // Disabled: self-hosted GoTrue refresh failures were triggering a
        // SIGNED_OUT → verifySession → getUser loop on /login. We refresh
        // manually after a successful signIn instead.
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[supabase] Initialisation désactivée:", error);
    return createDisabledSupabaseClient();
  }
};

export const supabase: SupabaseClient = createSupabaseClient();
export const supabaseConfigError = supabaseConfigured ? null : configErrorMessage;

// Remplace l'ancienne fonction
export const usernameToEmail = async (username: string): Promise<string> => {
  const { data, error } = await supabase
    .rpc("resolve_username_email", { p_username: username.trim().toLowerCase() });

  if (error || !data) throw new Error("Utilisateur introuvable.");
  return data;
};
