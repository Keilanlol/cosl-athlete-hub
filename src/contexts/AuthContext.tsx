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
const AUTH_TIMEOUT_MS = 8_000;

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
      (async () => {
        try {
          const { data, error } = await withTimeout(
            supabase
              .from("user_profiles")
              .select("username, full_name, role")
              .eq("id", u.id)
              .maybeSingle(),
            AUTH_TIMEOUT_MS,
            "profile timeout",
          );
          if (cancelled || requestId !== profileRequestRef.current) return;
          if (error) {
            console.error("[auth] profile fetch error:", error);
            return;
          }
          if (!data) {
            console.warn("[auth] no user_profiles row for", u.id, "(check RLS or trigger)");
            return;
          }
          console.info("[auth] profile loaded:", data);
          setUsername(data.username ?? null);
          setFullName(data.full_name ?? null);
          setRole((data.role as UserRole | undefined) ?? null);
        } catch (e) {
          console.error("[auth] loadProfile threw:", e);
        }
      })();
    };

    const commitVerifiedSession = (s: Session, verifiedUser: User) => {
      validatedTokenRef.current = s.access_token;
      setSession((prev) => (prev?.access_token === s.access_token ? prev : s));
      setUser((prev) => (prev?.id === verifiedUser.id ? prev : verifiedUser));
      setLoading(false);
      loadProfile(verifiedUser);
    };

    const verifySession = (s: Session | null) => {
      if (!s?.access_token || !s.user?.id) {
        clearAuth();
        return;
      }

      const token = s.access_token;
      const sessionUserId = s.user.id;
      const pendingSession: Session = s;

      if (validatedTokenRef.current === token) {
        setLoading(false);
        return;
      }

      const requestId = ++authRequestRef.current;

      setTimeout(async () => {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.getUser(),
            AUTH_TIMEOUT_MS,
            "getUser timeout",
          );
          if (cancelled || requestId !== authRequestRef.current) return;
          const verifiedUser = data.user;
          if (error || !verifiedUser || verifiedUser.id !== sessionUserId) {
            await supabase.auth.signOut();
            if (!cancelled && requestId === authRequestRef.current) clearAuth();
            return;
          }
          commitVerifiedSession(pendingSession, verifiedUser);
        } catch (e) {
          console.warn("[auth] getUser failed:", e);
          if (!cancelled && requestId === authRequestRef.current) clearAuth();
        }
      }, 0);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        clearAuth();
        return;
      }
      verifySession(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      verifySession(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (uname: string, password: string) => {
  let email: string;
  try {
    email = await usernameToEmail(uname);
  } catch {
    return {
      data: { user: null, session: null },
      error: { message: "Utilisateur introuvable.", status: 400 } as any,
    };
  }
  return supabase.auth.signInWithPassword({ email, password });
}, []);

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

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
