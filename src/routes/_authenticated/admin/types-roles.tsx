import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  Lock,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAppTypes, type AppTypeItem, type AppTypeGroup } from "@/lib/app-types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortBtn } from "@/components/DataTableShell";

type SortKey = "sort_order" | "code" | "label" | "is_system";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/admin/types-roles")({
  component: TypesRolesPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Add dialog
// ─────────────────────────────────────────────────────────────────────────────

function AddTypeDialog({
  open,
  onOpenChange,
  group,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: AppTypeGroup;
  onAdd: (code: string, label: string) => Promise<boolean>;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCode("");
      setLabel("");
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    const ok = await onAdd(code, label);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter — {group.label}</DialogTitle>
          <DialogDescription>{group.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ex. nouveau_role"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Identifiant technique (minuscules, sans espaces). Sera normalisé automatiquement.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Libellé</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Nouveau rôle"
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.trim() && label.trim()) submit();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !code.trim() || !label.trim()}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            {saving ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit dialog
// ─────────────────────────────────────────────────────────────────────────────

function EditTypeDialog({
  item,
  onOpenChange,
  onSave,
}: {
  item: AppTypeItem | null;
  onOpenChange: (v: boolean) => void;
  onSave: (item: AppTypeItem, label: string) => Promise<boolean>;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLabel(item?.label ?? "");
  }, [item]);

  const submit = async () => {
    if (!item) return;
    setSaving(true);
    const ok = await onSave(item, label);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le libellé</DialogTitle>
          <DialogDescription>
            Code : <span className="font-mono font-medium">{item?.code}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Libellé</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && label.trim()) submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !label.trim()}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group panel (table + search for one group)
// ─────────────────────────────────────────────────────────────────────────────

function GroupPanel({
  group,
  onAdd,
  onEdit,
  onDelete,
}: {
  group: AppTypeGroup;
  onAdd: () => void;
  onEdit: (item: AppTypeItem) => void;
  onDelete: (item: AppTypeItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "sort_order",
    dir: "asc",
  });

  const filtered = useMemo(() => {
    let r = group.items.filter(
      (i) =>
        !search.trim() ||
        i.label.toLowerCase().includes(search.trim().toLowerCase()) ||
        i.code.toLowerCase().includes(search.trim().toLowerCase()),
    );
    r.sort((a, b) => {
      const av = ((a as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const bv = ((b as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [group.items, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (code ou libellé)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {group.items.length} entrée(s)
        </p>
        <Button onClick={onAdd} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {group.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="Aucune entrée dans ce groupe."
              action={
                <Button onClick={onAdd} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24"><SortBtn active={sort.key === "sort_order"} dir={sort.dir} onClick={() => toggleSort("sort_order")}>Ordre</SortBtn></TableHead>
                <TableHead className="w-56"><SortBtn active={sort.key === "code"} dir={sort.dir} onClick={() => toggleSort("code")}>Code</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "label"} dir={sort.dir} onClick={() => toggleSort("label")}>Libellé</SortBtn></TableHead>
                <TableHead className="w-24"><SortBtn active={sort.key === "is_system"} dir={sort.dir} onClick={() => toggleSort("is_system")}>Type</SortBtn></TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {item.sort_order}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{item.code}</span>
                  </TableCell>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell>
                    {item.is_system ? (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" /> Système
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[var(--lux-blue)] border-[var(--lux-blue)]/30">
                        Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(item)}
                        title="Modifier le libellé"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => onDelete(item)}
                        disabled={item.is_system}
                        title={
                          item.is_system
                            ? "Les entrées système ne peuvent pas être supprimées"
                            : "Supprimer"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

function TypesRolesPage() {
  const { role, loading: authLoading } = useAuth();
  const { groups, loading, addItem, updateItem, deleteItem } = useAppTypes();

  const [activeTab, setActiveTab] = useState(groups[0]?.key ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppTypeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppTypeItem | null>(null);

  // Keep active tab in sync once groups are loaded
  useEffect(() => {
    if (groups.length > 0 && !groups.find((g) => g.key === activeTab)) {
      setActiveTab(groups[0].key);
    }
  }, [groups, activeTab]);

  const activeGroup = groups.find((g) => g.key === activeTab) ?? groups[0];

  const handleAdd = async (code: string, label: string) => {
    if (!activeGroup) return false;
    return addItem(activeGroup.key, code, label);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteItem(deleteTarget);
    if (ok) setDeleteTarget(null);
  };

  // ── Guards ──────────────────────────────────────────────────────────────────
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <Tag className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Types & Rôles</h1>
          <p className="text-sm text-muted-foreground">
            Gestion centralisée des types, catégories et rôles utilisés dans l'application.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-md border border-[var(--lux-blue)]/20 bg-[var(--lux-blue-light)] px-4 py-3 text-sm text-foreground">
        <p>
          <span className="font-semibold">💡 Info :</span> Les entrées marquées{" "}
          <Badge variant="outline" className="mx-1 gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Système
          </Badge>
          sont issues du schéma de base et ne peuvent pas être supprimées. Leur libellé reste
          modifiable. Les entrées{" "}
          <Badge variant="outline" className="mx-1 text-[var(--lux-blue)] border-[var(--lux-blue)]/30">
            Custom
          </Badge>
          sont entièrement gérables (ajout, modification, suppression).
        </p>
      </div>

      {loading ? (
        <TableSkeleton cols={5} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            {groups.map((g) => (
              <TabsTrigger key={g.key} value={g.key} className="text-xs">
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {groups.map((g) => (
            <TabsContent key={g.key} value={g.key} className="mt-4">
              <GroupPanel
                group={g}
                onAdd={() => {
                  setActiveTab(g.key);
                  setAddOpen(true);
                }}
                onEdit={(item) => setEditTarget(item)}
                onDelete={(item) => setDeleteTarget(item)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Add dialog */}
      {activeGroup && (
        <AddTypeDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          group={activeGroup}
          onAdd={handleAdd}
        />
      )}

      {/* Edit dialog */}
      <EditTypeDialog
        item={editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSave={updateItem}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.label}
              </span>{" "}
              (code : <span className="font-mono">{deleteTarget?.code}</span>).
              <br />
              Si cette valeur est utilisée par des enregistrements existants, la suppression
              échouera et vous devrez d'abord retirer ces liaisons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}