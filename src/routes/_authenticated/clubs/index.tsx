import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Club, ClubMember, Federation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  EmptyState,
  PAGE_SIZE,
  PagerBar,
  SortBtn,
  TableSkeleton,
} from "@/components/DataTableShell";
import { OrganizationFormDialog } from "@/components/forms/OrganizationFormDialog";
import type { ClubForm } from "@/lib/form-schemas";
import { confirmAction } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/clubs/")({
  component: ClubsPage,
});

type SortKey = "name" | "city";

function ClubsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Club[] | null>(null);
  const [feds, setFeds] = useState<Federation[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [search, setSearch] = useState("");
  const [fedFilter, setFedFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Club | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fedMap = useMemo(() => {
    const m = new Map<string, Federation>();
    feds.forEach((f) => m.set(f.id, f));
    return m;
  }, [feds]);

  const presidentByClub = useMemo(() => {
    const m = new Map<string, ClubMember>();
    members.forEach((mem) => {
      if (mem.role === "president" && (mem.is_active ?? true) && !m.has(mem.club_id)) {
        m.set(mem.club_id, mem);
      }
    });
    return m;
  }, [members]);

  const load = async () => {
    setRows(null);
    const [{ data: cd, error: ce }, { data: fd, error: fe }, { data: md }] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("federations").select("*").order("acronym"),
      supabase.from("club_members").select("*"),
    ]);
    if (ce || fe) {
      toast.error("Erreur de chargement", {
        description: (ce ?? fe)?.message,
      });
      setRows([]);
      return;
    }
    setRows((cd ?? []) as Club[]);
    setFeds((fd ?? []) as Federation[]);
    setMembers((md ?? []) as ClubMember[]);
  };

  useEffect(() => {
    load();
  }, []);

  const cities = useMemo(
    () =>
      Array.from(
        new Set((rows ?? []).map((c) => c.city).filter((v): v is string => !!v)),
      ).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.slice();
    if (fedFilter === "__none__") r = r.filter((c) => !c.federation_id);
    else if (fedFilter !== "all") r = r.filter((c) => c.federation_id === fedFilter);
    if (cityFilter !== "all") r = r.filter((c) => c.city === cityFilter);
    if (q) r = r.filter((c) => c.name.toLowerCase().includes(q));
    r.sort((a, b) => {
      const av = (a[sort.key] ?? "").toString().toLowerCase();
      const bv = (b[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, fedFilter, cityFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, fedFilter, cityFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (c: Club) => {
    setEditing(c);
    setOpen(true);
  };

  const submit = async (values: ClubForm | { name: string; federation_id: string }) => {
    const v = values as ClubForm;
    setSaving(true);
    const street = v.street?.trim() ?? "";
    const city = v.city?.trim() ?? "";
    const postcode = v.postcode?.trim() ?? "";
    const country = v.country?.trim() ?? "";
    const fullAddress =
      [street, [postcode, city].filter(Boolean).join(" "), country]
        .filter(Boolean)
        .join(", ") || null;
    const payload = {
      name: v.name.trim(),
      federation_id: v.federation_id,
      city: city || null,
      address: fullAddress,
      street: street || null,
      postcode: postcode || null,
      country: country || null,
      email: v.email?.trim() || null,
      phone: v.phone?.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("clubs").update(payload).eq("id", editing.id)
      : await supabase.from("clubs").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(editing ? "Club modifié" : "Club ajouté");
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const ok = await confirmAction({
      title: "Supprimer ce club ?",
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) {
      setDeleteId(null);
      return;
    }
    const { count, error: ce } = await supabase
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .eq("current_club_id", deleteId)
      .eq("is_active", true);
    if (ce) {
      toast.error("Suppression impossible", { description: friendlyError(ce) });
      setDeleteId(null);
      return;
    }
    if ((count ?? 0) > 0) {
      toast.error("Suppression impossible", {
        description: `Ce club compte encore ${count} athlète(s) actif(s). Désactivez-les d'abord.`,
      });
      setDeleteId(null);
      return;
    }
    const { error } = await supabase.from("clubs").delete().eq("id", deleteId);
    if (error) toast.error("Suppression impossible", { description: friendlyError(error) });
    else {
      toast.success("Club supprimé");
      load();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Clubs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Clubs affiliés aux fédérations nationales.
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary hover:bg-[var(--cosl-red-dark)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un club
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={fedFilter} onValueChange={setFedFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Toutes les fédérations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fédérations</SelectItem>
            <SelectItem value="__none__">Sans fédération</SelectItem>
            {feds.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.acronym} — {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Toutes villes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes villes</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={7} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun club enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("name")}
                  >
                    Nom
                  </SortBtn>
                </TableHead>
                <TableHead>Fédération</TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "city"}
                    dir={sort.dir}
                    onClick={() => toggleSort("city")}
                  >
                    Ville
                  </SortBtn>
                </TableHead>
                <TableHead>Président</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const f = fedMap.get(c.federation_id);
                const pres = presidentByClub.get(c.id);
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => navigate({ to: "/clubs/$id", params: { id: c.id } })}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell>
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url}
                            alt={c.name}
                            className="h-full w-full object-contain p-0.5"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {c.name?.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {f ? (
                        <Link to="/federations/$id" params={{ id: f.id }}>
                          <Badge variant="outline" className="font-mono hover:bg-muted">
                            {f.acronym}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.city ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {pres ? `${pres.first_name} ${pres.last_name}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pres?.email ?? c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pres?.phone ?? c.phone ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(c.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={pageCount} onChange={setPage} />

      <OrganizationFormDialog
        type="club"
        open={open}
        onOpenChange={setOpen}
        editing={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                federation_id: editing.federation_id,
                email: editing.email,
                phone: editing.phone,
                street: editing.street,
                postcode: editing.postcode,
                city: editing.city,
                country: editing.country,
              }
            : null
        }
        federations={feds}
        onSubmit={submit}
        loading={saving}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce club ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
