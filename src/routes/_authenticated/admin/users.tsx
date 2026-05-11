import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase, usernameToEmail } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { type UserProfile, USER_ROLES } from "@/lib/types";
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
  username: string;
  full_name: string;
  email: string;
  role: UserProfile["role"];
  password: string;
};

const emptyForm: CreateForm = {
  username: "",
  full_name: "",
  email: "",
  role: "reader",
  password: "",
};

function AdminUsersPage() {
  const { role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDel, setConfirmDel] = useState<UserProfile | null>(null);

  const isAdmin = role === "admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error("Erreur de chargement", { description: error.message });
    setUsers((data ?? []) as UserProfile[]);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paged = useMemo(
    () => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [users, page],
  );

  const submit = async () => {
    if (!form.username.trim()) return toast.error("Username requis");
    if (!form.full_name.trim()) return toast.error("Nom complet requis");
    if (form.password.length < 8) return toast.error("Mot de passe ≥ 8 caractères");

    setSubmitting(true);
    // NOTE : pas d'Edge Function disponible dans ce déploiement (SPA + Express).
    // L'inscription utilise supabase.auth.signUp ; le trigger handle_new_user
    // crée le user_profile à partir de raw_user_meta_data (username, full_name, role).
    const email = form.email.trim() || usernameToEmail(form.username);
    const { error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: {
          username: form.username.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          role: form.role,
        },
      },
    });
    setSubmitting(false);
    if (error) return toast.error("Échec création", { description: error.message });
    toast.success("Utilisateur créé");
    setOpen(false);
    setForm(emptyForm);
    // Petit délai pour laisser le trigger insérer le profil
    setTimeout(load, 800);
  };

  const updateRole = async (u: UserProfile, newRole: UserProfile["role"]) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({ role: newRole })
      .eq("id", u.id);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Rôle mis à jour");
    setUsers((arr) => arr.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
  };

  const deactivate = async () => {
    if (!confirmDel) return;
    // Suppression du profil — l'utilisateur auth reste mais perd l'accès applicatif.
    // (La suppression complète de auth.users nécessite la SERVICE_ROLE_KEY côté serveur.)
    const { error } = await supabase.from("user_profiles").delete().eq("id", confirmDel.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Utilisateur désactivé"); load(); }
    setConfirmDel(null);
  };

  if (authLoading) {
    return <div className="p-6 text-sm text-slate-500">Chargement…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Accès restreint</h1>
        <p className="mt-1 text-sm text-slate-600">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Comptes COSL</h1>
          <p className="text-sm text-slate-500">Gestion des utilisateurs et de leurs rôles.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un utilisateur
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <TableSkeleton cols={6} />
        ) : users.length === 0 ? (
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
                const r = USER_ROLES.find((x) => x.value === u.role);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                    <TableCell>
                      {r && <Badge className={`${r.cls} hover:${r.cls}`}>{r.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{fmt(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRole(u, v as UserProfile["role"])}
                        >
                          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {USER_ROLES.map((x) => (
                              <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setConfirmDel(u)}
                        >
                          Désactiver
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>
              Le compte est créé via Supabase Auth. Le profil applicatif est généré automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="jdupont"
              />
            </div>
            <div className="space-y-1">
              <Label>Nom complet</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Email (optionnel)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="laissé vide → username@coslbloobiz.local"
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
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
              className="bg-indigo-500 hover:bg-indigo-600"
            >
              {submitting ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le profil applicatif sera supprimé. Le compte d'authentification reste, mais l'accès à l'application est révoqué.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deactivate} className="bg-red-600 hover:bg-red-700">
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
