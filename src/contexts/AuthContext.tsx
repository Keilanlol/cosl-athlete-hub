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
import { dlog } from "@/lib/debug-bus";

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
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current += 1;
    dlog("AuthProvider.render", `render #${renderCountRef.current}`, {
      loading,
      hasSession: !!session,
      hasUser: !!user,
    });
  });

  useEffect(() => {
    dlog("AuthProvider.mount", "useEffect mount");
    let cancelled = false;

    const clearAuth = () => {
      dlog("auth.clearAuth", "clearing all auth state");
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
      dlog("auth.loadProfile", "fetching profile", { userId: u.id, requestId });
      setTimeout(async () => {
        const { data, error } = await withTimeout(
          supabase
            .from("user_profiles")
            .select("username, full_name, role")
            .eq("id", u.id)
            .maybeSingle(),
          AUTH_TIMEOUT_MS,
          "profile timeout",
        );
        if (cancelled || requestId !== profileRequestRef.current) {
          dlog("auth.loadProfile", "stale, dropped", { requestId });
          return;
        }
        if (error) {
          dlog("auth.loadProfile", "error", error.message);
          return;
        }
        dlog("auth.loadProfile", "ok", data);
        const nextUsername = data?.username ?? null;
        const nextFullName = data?.full_name ?? null;
        const nextRole = (data?.role as UserRole | undefined) ?? null;
        setUsername((prev) => (prev === nextUsername ? prev : nextUsername));
        setFullName((prev) => (prev === nextFullName ? prev : nextFullName));
        setRole((prev) => (prev === nextRole ? prev : nextRole));
      }, 0);
    };

    const commitVerifiedSession = (s: Session, verifiedUser: User) => {
      dlog("auth.commit", "verified session", { userId: verifiedUser.id });
      validatedTokenRef.current = s.access_token;
      setSession((prev) => (prev?.access_token === s.access_token ? prev : s));
      setUser((prev) => (prev?.id === verifiedUser.id ? prev : verifiedUser));
      setLoading(false);
      loadProfile(verifiedUser);
    };

    const verifySession = (s: Session | null) => {
      dlog("auth.verifySession", "called", {
        hasToken: !!s?.access_token,
        hasUser: !!s?.user?.id,
      });
      if (!s?.access_token || !s.user?.id) {
        clearAuth();
        return;
      }

      const token = s.access_token;
      const sessionUserId = s.user.id;
      const pendingSession: Session = s;

      if (validatedTokenRef.current === token) {
        dlog("auth.verifySession", "token already validated, skip");
        setLoading(false);
        return;
      }

      const requestId = ++authRequestRef.current;
      dlog("auth.verifySession", "calling getUser()", { requestId });

      setTimeout(async () => {
        const t0 = Date.now();
        try {
          const { data, error } = await withTimeout(
            supabase.auth.getUser(),
            AUTH_TIMEOUT_MS,
            "getUser timeout",
          );
          dlog("auth.getUser", `returned in ${Date.now() - t0}ms`, {
            requestId,
            hasUser: !!data?.user,
            error: error?.message,
          });
          if (cancelled || requestId !== authRequestRef.current) {
            dlog("auth.getUser", "stale, dropped");
            return;
          }
          const verifiedUser = data.user;
          if (error || !verifiedUser || verifiedUser.id !== sessionUserId) {
            dlog("auth.getUser", "invalid → signOut", { error: error?.message });
            await supabase.auth.signOut();
            if (!cancelled && requestId === authRequestRef.current) clearAuth();
            return;
          }
          commitVerifiedSession(pendingSession, verifiedUser);
        } catch (e) {
          dlog("auth.getUser", "THREW", String(e));
          if (!cancelled && requestId === authRequestRef.current) clearAuth();
        }
      }, 0);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      dlog("auth.onAuthStateChange", event, {
        hasSession: !!s,
        userId: s?.user?.id,
      });
      if (event === "SIGNED_OUT") {
        clearAuth();
        return;
      }
      verifySession(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      dlog("auth.getSession", "initial", { hasSession: !!s });
      if (cancelled) return;
      verifySession(s);
    });

    return () => {
      dlog("AuthProvider.unmount", "cleanup");
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
