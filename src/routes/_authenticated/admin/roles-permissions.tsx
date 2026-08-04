import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { useTypeGroup } from "@/hooks/useTypeItems";
import { useAuth } from "@/hooks/useAuth";
import { MODULES, DOC_CATEGORIES } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/admin/roles-permissions")({
  component: RolesPermissionsPage,
});

type ModulePerm = { can_read: boolean; can_write: boolean; can_delete: boolean };
type DocPerm = { can_read: boolean; can_write: boolean };

function RolesPermissionsPage() {
  const { role, loading: authLoading } = useAuth();
  const userRolesHook = useTypeGroup("user_roles");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [modulePerms, setModulePerms] = useState<Record<string, ModulePerm>>({});
  const [docPerms, setDocPerms] = useState<Record<string, DocPerm>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedRole) {
      if (userRolesHook.items.length > 0) setSelectedRole(userRolesHook.items[0].code);
      return;
    }
    loadPerms(selectedRole);
  }, [selectedRole, userRolesHook.items]);

  const loadPerms = async (roleCode: string) => {
    const [modRes, docRes] = await Promise.all([
      supabase.from("role_permissions").select("*").eq("role_code", roleCode),
      supabase.from("role_document_access").select("*").eq("role_code", roleCode),
    ]);

    const modMap: Record<string, ModulePerm> = {};
    (modRes.data ?? []).forEach((r) => {
      const row = r as { module: string; can_read: boolean; can_write: boolean; can_delete: boolean };
      modMap[row.module] = { can_read: row.can_read, can_write: row.can_write, can_delete: row.can_delete };
    });

    const docMap: Record<string, DocPerm> = {};
    (docRes.data ?? []).forEach((r) => {
      const row = r as { doc_category: string; can_read: boolean; can_write: boolean };
      docMap[row.doc_category] = { can_read: row.can_read, can_write: row.can_write };
    });

    setModulePerms(modMap);
    setDocPerms(docMap);
  };

  const toggleModule = (module: string, field: keyof ModulePerm) => {
    setModulePerms((prev) => {
      const current = prev[module] ?? { can_read: false, can_write: false, can_delete: false };
      return { ...prev, [module]: { ...current, [field]: !current[field] } };
    });
  };

  const toggleDoc = (category: string, field: keyof DocPerm) => {
    setDocPerms((prev) => {
      const current = prev[category] ?? { can_read: false, can_write: false };
      return { ...prev, [category]: { ...current, [field]: !current[field] } };
    });
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);

    // Supprimer et recréer les permissions (approche simple)
    await supabase.from("role_permissions").delete().eq("role_code", selectedRole);
    await supabase.from("role_document_access").delete().eq("role_code", selectedRole);

    const modRows = Object.entries(modulePerms).map(([module, p]) => ({
      role_code: selectedRole,
      module,
      can_read: p.can_read,
      can_write: p.can_write,
      can_delete: p.can_delete,
    }));

    const docRows = Object.entries(docPerms).map(([doc_category, p]) => ({
      role_code: selectedRole,
      doc_category,
      can_read: p.can_read,
      can_write: p.can_write,
    }));

    if (modRows.length > 0) {
      const { error } = await supabase.from("role_permissions").insert(modRows);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        setSaving(false);
        return;
      }
    }

    if (docRows.length > 0) {
      const { error } = await supabase.from("role_document_access").insert(docRows);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        setSaving(false);
        return;
      }
    }

    toast.success("Permissions enregistrées");
    setSaving(false);
  };

  if (authLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  if (role !== "admin") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Accès restreint</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accès réservé aux administrateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rôles & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Définissez les accès de chaque rôle aux modules et aux catégories de documents.
          </p>
        </div>
      </div>

      {/* Sélecteur de rôle */}
      <div className="flex flex-wrap gap-2">
        {userRolesHook.items.map((r) => (
          <button key={r.code} onClick={() => setSelectedRole(r.code)} className="focus:outline-none">
            <Badge
              className={`cursor-pointer text-sm ${
                selectedRole === r.code
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {r.label}
            </Badge>
          </button>
        ))}
      </div>

      {userRolesHook.loading ? (
        <TableSkeleton cols={5} />
      ) : !selectedRole ? (
        <EmptyState message="Sélectionnez un rôle." />
      ) : (
        <>
          {/* Permissions par module */}
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-center">Lecture</TableHead>
                  <TableHead className="text-center">Écriture</TableHead>
                  <TableHead className="text-center">Suppression</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULES.map((m) => {
                  const p = modulePerms[m.key] ?? { can_read: false, can_write: false, can_delete: false };
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_read} onCheckedChange={() => toggleModule(m.key, "can_read")} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_write} onCheckedChange={() => toggleModule(m.key, "can_write")} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_delete} onCheckedChange={() => toggleModule(m.key, "can_delete")} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Permissions par catégorie de document */}
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Accès aux documents par catégorie</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Contrôle l'accès aux documents sensibles (passeports, fiches médicales, etc.) selon leur catégorie.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-center">Lecture</TableHead>
                  <TableHead className="text-center">Écriture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DOC_CATEGORIES.map((c) => {
                  const p = docPerms[c.key] ?? { can_read: false, can_write: false };
                  return (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_read} onCheckedChange={() => toggleDoc(c.key, "can_read")} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={p.can_write} onCheckedChange={() => toggleDoc(c.key, "can_write")} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer les permissions"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}