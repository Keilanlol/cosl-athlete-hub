import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, usernameToEmail } from "@/lib/supabase";

export type UserRole =
  | "admin"
  | "games_manager"
  | "fed_manager"
  | "logistics"
  | "communication"
  | "reader";

interface UserProfile {
  username: string | null;
  full_name: string | null;
  role: UserRole | null;
}

interface AuthState extends UserProfile {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const initialState: AuthState = {
  session: null,
  user: null,
  username: null,
  full_name: null,
  role: null,
  loading: true,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  const loadProfile = useCallback((user: User | null) => {
    if (!user) {
      setState((s) => ({ ...s, username: null, full_name: null, role: null }));
      return;
    }
    // Defer profile fetch to avoid auth deadlocks
    setTimeout(async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("username, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[useAuth] profile fetch failed:", error.message);
        return;
      }
      setState((s) => ({
        ...s,
        username: data?.username ?? null,
        full_name: data?.full_name ?? null,
        role: (data?.role as UserRole | undefined) ?? null,
      }));
    }, 0);
  }, []);

  useEffect(() => {
    // 1. Subscribe FIRST
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
      loadProfile(session?.user ?? null);
    });

    // 2. THEN read existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
      loadProfile(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (username: string, password: string) => {
    return supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
  }, []);

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signOut };
}
