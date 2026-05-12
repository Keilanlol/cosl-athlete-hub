import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(username, password);
    setSubmitting(false);
    if (error) setError("Identifiants invalides.");
  };

  return (
    <AuthLayout>
      {!supabaseConfigured && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Configuration Lovable Cloud manquante : crée un fichier <code>.env</code> avec
          <code> VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> (voir
          <code> .env.example</code>) puis relance le build.
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">Nom d'utilisateur</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-500 hover:bg-indigo-600"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Se connecter
        </Button>
        <p className="text-center text-xs text-slate-500">
          Comptes créés par un administrateur COSL.
        </p>
      </form>
    </AuthLayout>
  );
}
