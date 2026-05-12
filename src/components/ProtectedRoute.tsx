import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { dlog } from "@/lib/debug-bus";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth();
  const isAuthValid = !!session?.access_token && !!user?.id;
  dlog("ProtectedRoute.render", "render", { loading, isAuthValid });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthValid) {
    dlog("ProtectedRoute", "redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

