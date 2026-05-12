import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, usernameToEmail } from "@/lib/supabase";

export type UserRole =
  | "admin"
  | "games_manager"
  | "fed_manager"
  | "logistics"
  | "communication"
  | "reader";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  username: string | null;
  full_name: string | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (
    username: string,
    password: string,
  ) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signOut: () => ReturnType<typeof supabase.auth.signOut>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestRef = useRef(0);
  const authRequestRef = useRef(0);
  const validatedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearAuth = () => {
      profileRequestRef.current += 1;
      validatedTokenRef.current = null;
      setSession(null);
      setUser(null);
      setUsername(null);
      setFullName(null);
      setRole(null);
      setLoading(false);
    };

    const loadProfile = (u: User | null) => {
      const requestId = ++profileRequestRef.current;
      if (!u) {
        setUsername(null);
        setFullName(null);
        setRole(null);
        return;
      }
      // Defer to avoid auth deadlocks
      setTimeout(async () => {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("username, full_name, role")
          .eq("id", u.id)
          .maybeSingle();
        if (cancelled || requestId !== profileRequestRef.current) return;
        if (error) {
          console.warn("[auth] profile fetch failed:", error.message);
          return;
        }
        const nextUsername = data?.username ?? null;
        const nextFullName = data?.full_name ?? null;
        const nextRole = (data?.role as UserRole | undefined) ?? null;
        setUsername((prev) => (prev === nextUsername ? prev : nextUsername));
        setFullName((prev) => (prev === nextFullName ? prev : nextFullName));
        setRole((prev) => (prev === nextRole ? prev : nextRole));
      }, 0);
    };

    const commitVerifiedSession = (s: Session, verifiedUser: User) => {
      validatedTokenRef.current = s.access_token;
      setSession((prev) => (prev?.access_token === s.access_token ? prev : s));
      setUser((prev) => (prev?.id === verifiedUser.id ? prev : verifiedUser));
      setLoading(false);
      loadProfile(verifiedUser);
    };

    const verifySession = (s: Session | null) => {
      const token = s?.access_token ?? null;
      const sessionUserId = s?.user?.id ?? null;

      if (!token || !sessionUserId) {
        clearAuth();
        return;
      }

      if (validatedTokenRef.current === token) {
        setLoading(false);
        return;
      }

      const requestId = ++authRequestRef.current;

      setTimeout(async () => {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled || requestId !== authRequestRef.current) return;

        const verifiedUser = data.user;
        if (error || !verifiedUser || verifiedUser.id !== sessionUserId) {
          await supabase.auth.signOut();
          if (!cancelled && requestId === authRequestRef.current) clearAuth();
          return;
        }

        commitVerifiedSession(s, verifiedUser);
      }, 0);
    };

    // 1. Subscribe FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        clearAuth();
        return;
      }
      verifySession(s);
    });

    // 2. THEN load existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      verifySession(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    (uname: string, password: string) =>
      supabase.auth.signInWithPassword({
        email: usernameToEmail(uname),
        password,
      }),
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = useMemo(
    () => ({
      session,
      user,
      username,
      full_name: fullName,
      role,
      loading,
      signIn,
      signOut,
    }),
    [session, user, username, fullName, role, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
