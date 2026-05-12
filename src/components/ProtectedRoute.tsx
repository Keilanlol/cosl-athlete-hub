import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isAuthValid = !!session?.access_token && !!user?.id;

  useEffect(() => {
    if (loading || isRedirecting) return;
    if (!isAuthValid) {
      setIsRedirecting(true);
      navigate({ to: "/login" });
    }
  }, [loading, isAuthValid, navigate, isRedirecting]);

  if (loading || !isAuthValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return <>{children}</>;
}
