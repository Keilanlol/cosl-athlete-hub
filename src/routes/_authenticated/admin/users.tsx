import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldAlert, Search, UserCog, Copy, Check, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { type UserProfile } from "@/lib/types";
import { useTypeGroup, clsForCode } from "@/hooks/useTypeItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableSkeleton, EmptyState, PagerBar, PAGE_SIZE } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

type CreateForm = {
  first_name: string;
  last_name: string;
  email: string;
  role: UserProfile["role"];
  password: string;
};

type ShowOnceCredentials = {
  username: string;
  email: string;
  password: string;
};

const emptyForm: CreateForm = {
  first_name: "",
  last_name: "",
  email: "",
  role: "reader",
  password: "",
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

// ─────────────────────────────────────────────────────────────────────────────
// Show-once credentials modal
// ─────────────────────────────────────────────────────────────────────────────

function CredRow({
  label,
  value,
  field,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  field: string;
  copied: string | null;
  onCopy: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
        <span className="flex-1 select-all break-all font-mono text-sm">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onCopy(field, value)}
          title="Copier"
        >
          {copied === field ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ShowOnceModal({
  creds,
  open,
  onOpenChange,
}: {
  creds: ShowOnceCredentials | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for non-HTTPS contexts
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!creds) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Identifiants du compte</DialogTitle>
          <DialogDescription>
            Transmettez ces identifiants à l'utilisateur via un canal sécurisé (message chiffré, etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
          ⚠️ Ces informations ne sont affichées qu'une seule fois et ne pourront jamais être
          récupérées. Copiez-les avant de fermer cette fenêtre.
        </div>

        <div className="space-y-3">
          <CredRow label="Username" value={creds.username} field="username" copied={copied} onCopy={copy} />
          <CredRow label="Email" value={creds.email} field="email" copied={copied} onCopy={copy} />
          <CredRow label="Mot de passe" value={creds.password} field="password" copied={copied} onCopy={copy} />
        </div>

        <DialogFooter>
          <Button
            className="w-full bg-primary hover:bg-[var(--cosl-red-dark)]"
            onClick={() => onOpenChange(false)}
          >
            J'ai copié les identifiants — Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

function AdminUsersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const userRolesHook = useTypeGroup("user_roles");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Create dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [confirmDel, setConfirmDel] = useState<UserProfile | null>(null);

  // Show-once credentials modal
  const [credsOpen, setCredsOpen] = useState(false);
  const [lastCreds, setLastCreds] = useState<ShowOnceCredentials | null>(null);

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => { setPage(1); }, [search, roleFilter]);

  const isAdmin = role === "admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .neq("username", "admin")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error("Erreur de chargement", { description: friendlyError(error) });
    setUsers((data ?? []) as UserProfile[]);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (q && !`${u.username} ${u.full_name} ${u.email ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const usernamePreview = useMemo(() => {
    const f = slugify(form.first_name);
    const l = slugify(form.last_name);
    if (!f || !l) return "";
    return `${f}.${l}`;
  }, [form.first_name, form.last_name]);

  // ── Create account ──────────────────────────────────────────────────────────
  const submit = async () => {
    if (!form.first_name.trim()) return toast.error("Prénom requis");
    if (!form.last_name.trim()) return toast.error("Nom requis");
    if (form.password.length < 8) return toast.error("Mot de passe ≥ 8 caractères");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_create_account_v2", {
      p_first_name: form.first_name.trim(),
      p_last_name:  form.last_name.trim(),
      p_email:      form.email.trim(),
      p_password:   form.password,
      p_role:       form.role,
    });
    setSubmitting(false);

    if (error) return toast.error("Échec création", { description: friendlyError(error) });

    // Capture form values before reset (usernamePreview is derived, may change)
    const capturedPreview = usernamePreview;
    const capturedEmail   = form.email.trim();
    const capturedPwd     = form.password;

    setOpen(false);
    setForm(emptyForm);
    load();

    // data = { id, username, email, password } after migration 37
    // data = null/void on older versions → fall back to form values
    const rpc = data as { username?: string; email?: string; password?: string } | null;
    setLastCreds({
      username: rpc?.username ?? capturedPreview,
      email:    rpc?.email    ?? (capturedEmail || `${capturedPreview}@coslbloobiz.local`),
      password: rpc?.password ?? capturedPwd,
    });
    setCredsOpen(true);
  };

  // ── Update role ─────────────────────────────────────────────────────────────
  const updateRole = async (u: UserProfile, newRole: UserProfile["role"]) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({ role: newRole })
      .eq("id", u.id);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Rôle mis à jour");
    setUsers((arr) => arr.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
  };

  // ── Delete account ──────────────────────────────────────────────────────────
  const deactivate = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.rpc("admin_delete_account", { p_user_id: confirmDel.id });
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Utilisateur supprimé"); load(); }
    setConfirmDel(null);
  };

  // ── Reset password ──────────────────────────────────────────────────────────
  const submitReset = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      toast.error("Mot de passe ≥ 8 caractères");
      return;
    }
    setResetSaving(true);
    const { data, error } = await supabase.rpc("admin_reset_password", {
      p_user_id:      resetTarget.id,
      p_new_password: resetPassword,
    });
    setResetSaving(false);

    if (error) {
      toast.error("Échec de la réinitialisation", { description: friendlyError(error) });
      return;
    }

    const capturedTarget = { ...resetTarget };
    const capturedPwd    = resetPassword;
    setResetTarget(null);
    setResetPassword("");

    // data = { username, password } after migration 37
    const rpc = data as { username?: string; password?: string } | null;
    setLastCreds({
      username: rpc?.username ?? capturedTarget.username,
      email:    capturedTarget.email ?? "",
      password: rpc?.password ?? capturedPwd,
    });
    setCredsOpen(true);
  };

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (authLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Accès restreint</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR");

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <UserCog className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Comptes COSL</h1>
            <p className="text-sm text-muted-foreground">Gestion des utilisateurs et de leurs rôles.</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un utilisateur
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (username, nom, email)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {userRolesHook.items.map((r) => (
              <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">{filtered.length} utilisateur(s)</p>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun utilisateur." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Nom complet</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((u) => {
                const r = userRolesHook.findItem(u.role);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono font-medium">{u.username}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {r && <Badge className={`${clsForCode("user_roles", u.role)} hover:${clsForCode("user_roles", u.role)}`}>{r.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmt(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {/* Reset password */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-[var(--lux-blue)] border-[var(--lux-blue)]/30 hover:bg-[var(--lux-blue-light)]"
                          onClick={() => {
                            setResetTarget(u);
                            setResetPassword("");
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Réinitialiser MDP
                        </Button>
                        {/* Change role */}
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRole(u, v as UserProfile["role"])}
                        >
                          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {userRolesHook.items.map((x) => (
                              <SelectItem key={x.code} value={x.code}>{x.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Delete */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setConfirmDel(u)}
                          disabled={u.id === user?.id}
                          title={
                            u.id === user?.id
                              ? "Vous ne pouvez pas supprimer votre propre compte"
                              : undefined
                          }
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={totalPages} onChange={setPage} />

      {/* ── Create account dialog ──────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>
              Le compte est créé via Supabase Auth. Les identifiants s'afficheront une seule fois après la création.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Prénom</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Jean"
              />
            </div>
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Dupont"
              />
            </div>
            {usernamePreview && (
              <div className="sm:col-span-2 -mt-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Username généré :{" "}
                <span className="font-mono font-medium text-foreground">{usernamePreview}</span>
                <span className="ml-1 opacity-70">(suffixe ajouté automatiquement en cas de doublon)</span>
              </div>
            )}
            <div className="sm:col-span-2 space-y-1">
              <Label>
                Email{" "}
                <span className="font-normal text-muted-foreground text-xs">(optionnel)</span>
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={
                  usernamePreview
                    ? `${usernamePreview}@coslbloobiz.local`
                    : "laissé vide → username@coslbloobiz.local"
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as UserProfile["role"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {userRolesHook.items.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mot de passe</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="≥ 8 caractères"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={submit}
              disabled={submitting}
              className="bg-primary hover:bg-[var(--cosl-red-dark)]"
            >
              {submitting ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset password dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(o) => {
          if (!o) { setResetTarget(null); setResetPassword(""); }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Nouveau mot de passe pour{" "}
              <span className="font-medium text-foreground">{resetTarget?.username}</span>.
              Les identifiants s'afficheront une seule fois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nouveau mot de passe</Label>
            <Input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="≥ 8 caractères"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && resetPassword.length >= 8) submitReset();
              }}
            />
            {resetPassword.length > 0 && resetPassword.length < 8 && (
              <p className="text-xs text-red-600">Minimum 8 caractères requis</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Annuler
            </Button>
            <Button
              onClick={submitReset}
              disabled={resetSaving || resetPassword.length < 8}
              className="bg-primary hover:bg-[var(--cosl-red-dark)]"
            >
              {resetSaving ? "Réinitialisation…" : "Réinitialiser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Show-once credentials modal ───────────────────────────────────── */}
      <ShowOnceModal
        creds={lastCreds}
        open={credsOpen}
        onOpenChange={(o) => {
          setCredsOpen(o);
          if (!o) setLastCreds(null);
        }}
      />

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte sera définitivement supprimé de la base de données (auth + profil).
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deactivate} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
