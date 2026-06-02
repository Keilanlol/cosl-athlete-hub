import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth();
  const isAuthValid = !!session?.access_token && !!user?.id;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthValid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
