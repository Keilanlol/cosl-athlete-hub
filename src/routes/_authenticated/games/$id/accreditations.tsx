import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, FileText, Check, X, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileUpload } from "@/components/FileUpload";
import { computeRequiredDocs, getSelectionStageForAthlete, getPersonIdForAthlete } from "@/lib/conformity-utils";
import type { PersonDocument } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/games/$id/accreditations")({
  component: GameAccreditationsPage,
});

const STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "draft", label: "Brouillon", cls: "bg-slate-200 text-foreground" },
  { value: "submitted", label: "Soumise", cls: "bg-amber-100 text-amber-700" },
  { value: "validated", label: "Validée", cls: "bg-emerald-100 text-emerald-700" },
  { value: "rejected", label: "Rejetée", cls: "bg-red-100 text-red-700" },
];

const DOC_STATUSES: Record<string, { label: string; cls: string }> = {
  missing: { label: "Manquant", cls: "bg-slate-200 text-foreground" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  valid: { label: "Valide", cls: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Expiré", cls: "bg-red-100 text-red-700" },
  rejected: { label: "Rejeté", cls: "bg-red-100 text-red-700" },
};

type Person = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null };
type AccDoc = {
  id: string; accreditation_id: string; doc_type: string;
  file_name: string; file_url: string | null; status: string; uploaded_at: string;
};
type Accreditation = {
  id: string; game_id: string; accreditation_type_id: string | null;
  athlete_id: string | null; coach_id: string | null;
  full_name: string; function_label: string | null;
  status: string; rejection_reason: string | null; notes: string | null;
  role_code: string | null;
  athlete: { id: string; cosl_id: string; email: string | null; phone: string | null } | null;
  coach: { id: string; role: string; email: string | null; phone: string | null } | null;
  docs: AccDoc[];
};

function GameAccreditationsPage() {
  const { id: gameId } = Route.useParams();
  const [accreds, setAccreds] = useState<Accreditation[] | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [game, setGame] = useState<{ name: string; short_name: string | null } | null>(null);
  const [roles, setRoles] = useState<{ code: string; label: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ code: string; label: string }[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Accred create dialog
  const [accOpen, setAccOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accForm, setAccForm] = useState({ person_id: "", role_code: "", function_label: "" });
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  // Drawer
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [drawerPersonDocs, setDrawerPersonDocs] = useState<PersonDocument[]>([]);
  const [drawerPersonId, setDrawerPersonId] = useState<string | null>(null);

  const load = async () => {
    setAccreds(null);
    const [aRes, pRes, gRes, rolesRes, dtRes] = await Promise.all([
      supabase.from("accreditations")
        .select("*, athlete:athletes(id,cosl_id,email,phone), coach:coaches(id,role,email,phone), docs:accreditation_documents(*)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase.from("persons")
        .select("id,first_name,last_name,email,phone")
        .eq("is_active", true)
        .order("last_name"),
      supabase.from("games").select("name,short_name").eq("id", gameId).maybeSingle(),
      supabase.from("app_type_items").select("code,label").eq("group_key", "accreditation_categories").order("sort_order"),
      supabase.from("app_type_items").select("code,label").eq("group_key", "document_types").order("sort_order"),
    ]);
    setAccreds(((aRes.data ?? []) as unknown) as Accreditation[]);
    setPersons((pRes.data ?? []) as Person[]);
    setGame((gRes.data ?? null) as { name: string; short_name: string | null } | null);
    setRoles((rolesRes.data ?? []) as { code: string; label: string }[]);
    setDocTypes((dtRes.data ?? []) as { code: string; label: string }[]);
  };

  useEffect(() => { load(); }, [gameId]);

  // Compute required docs when role changes in the create dialog
  useEffect(() => {
    if (accForm.role_code) {
      computeRequiredDocs(gameId, accForm.role_code).then((docs) => {
        setRequiredDocs(docs.map((d) => d.doc_type_code));
      });
    } else {
      setRequiredDocs([]);
    }
  }, [accForm.role_code, gameId]);

  const completeness = (a: Accreditation) => {
    // Compute from role_code + selection stage
    const roleCode = a.role_code ?? "athlete";
    // For athletes, determine required docs from selection stage
    // For now, use accreditation_documents as before
    const total = a.docs.length;
    if (total === 0) return 0;
    const valid = a.docs.filter((d) => d.status === "valid").length;
    return Math.round((valid / total) * 100);
  };

  const kpi = useMemo(() => {
    const list = accreds ?? [];
    const total = list.length;
    const validated = list.filter((a) => a.status === "validated").length;
    const pending = list.filter((a) => a.status === "submitted").length;
    const rejected = list.filter((a) => a.status === "rejected").length;
    return {
      total, validated, pending, rejected,
      validatedPct: total ? Math.round((validated / total) * 100) : 0,
    };
  }, [accreds]);

  const filteredAccreds = useMemo(() => {
    if (!accreds) return [];
    const q = search.trim().toLowerCase();
    return accreds.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (q && !a.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accreds, statusFilter, search]);

  // ==== Accreditation create ====
  const submitAccred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accForm.person_id || !accForm.role_code) {
      toast.error("Personne et rôle requis");
      return;
    }
    const person = persons.find((p) => p.id === accForm.person_id);
    if (!person) return;
    const payload = {
      game_id: gameId,
      athlete_id: accForm.role_code === "athlete" ? accForm.person_id : null,
      coach_id: accForm.role_code !== "athlete" ? accForm.person_id : null,
      full_name: `${person.first_name} ${person.last_name}`,
      function_label: accForm.function_label.trim() || null,
      status: "draft",
      role_code: accForm.role_code,
    };
    const { error } = await supabase.from("accreditations").insert(payload);
    if (error) { toast.error("Échec", { description: friendlyError(error) }); return; }
    toast.success("Accréditation créée");
    setAccOpen(false);
    setAccForm({ person_id: "", role_code: "", function_label: "" });
    load();
  };

  // ==== Drawer actions ====
  const current = (accreds ?? []).find((a) => a.id === openId) ?? null;

  // Load person documents for the drawer
  useEffect(() => {
    if (current) {
      const pid = current.athlete_id ?? current.coach_id;
      if (pid) {
        setDrawerPersonId(pid);
        supabase
          .from("person_documents")
          .select("*")
          .eq("person_id", pid)
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            setDrawerPersonDocs((data ?? []) as PersonDocument[]);
          });
      } else {
        setDrawerPersonId(null);
        setDrawerPersonDocs([]);
      }
    }
  }, [openId]);

  const uploadDoc = async (docType: string, url: string, fileName: string) => {
    if (!current) return;
    const existing = current.docs.find((d) => d.doc_type === docType);
    const payload = {
      accreditation_id: current.id,
      doc_type: docType,
      file_name: fileName,
      file_url: url,
      status: "pending",
      uploaded_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from("accreditation_documents").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("accreditation_documents").insert(payload);
    }
    toast.success("Document enregistré");
    load();
  };

  const uploadPersonDoc = async (docType: string, url: string, fileName: string) => {
    if (!drawerPersonId) return;
    await supabase.from("person_documents").insert({
      person_id: drawerPersonId,
      doc_type: docType,
      file_name: fileName,
      file_url: url,
      status: "pending",
    });
    toast.success("Document ajouté à la fiche personne");
    // Refresh person docs
    const { data } = await supabase
      .from("person_documents")
      .select("*")
      .eq("person_id", drawerPersonId)
      .order("created_at", { ascending: false });
    setDrawerPersonDocs((data ?? []) as PersonDocument[]);
  };

  const setDocStatus = async (doc: AccDoc, status: string) => {
    const { error } = await supabase.from("accreditation_documents").update({ status }).eq("id", doc.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Statut document mis à jour"); load(); }
  };

  const setAccredStatus = async (acc: Accreditation, status: string, reason?: string) => {
    const patch: { status: string; submitted_at?: string; validated_at?: string; rejection_reason?: string | null } = { status };
    if (status === "submitted") patch.submitted_at = new Date().toISOString();
    if (status === "validated") { patch.validated_at = new Date().toISOString(); patch.rejection_reason = null; }
    if (status === "rejected") patch.rejection_reason = reason ?? null;
    const { error } = await supabase.from("accreditations").update(patch).eq("id", acc.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Statut mis à jour"); load(); }
  };

  // Export
  const exportCsv = () => {
    if (!accreds || !game) return;
    const header = ["Rôle", "Nom complet", "Fonction", "Statut", "Complétude %"];
    const rows = accreds.map((a) => [
      a.role_code ?? "", a.full_name, a.function_label ?? "", a.status, String(completeness(a)),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`accreditations_${(game.short_name ?? game.name).replace(/\W+/g, "_")}.csv`, "text/csv", "\ufeff" + csv);
  };

  const selectedPerson = persons.find((p) => p.id === accForm.person_id);

  // Compute required docs for the drawer based on role + selection stage
  const drawerRequiredDocs = useMemo(() => {
    if (!current) return [];
    const roleCode = current.role_code ?? "athlete";
    return requiredDocs.length > 0 ? requiredDocs : [];
  }, [current, requiredDocs]);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total accréditations" value={kpi.total} />
        <Kpi label="Validées" value={`${kpi.validated} (${kpi.validatedPct}%)`} tone="emerald" />
        <Kpi label="En attente" value={kpi.pending} tone="amber" />
        <Kpi label="Rejetées" value={kpi.rejected} tone="red" />
      </div>

      <div className="flex justify-between gap-2">
        <Button asChild variant="outline">
          <Link to="/accreditations/$gameId" params={{ gameId }}>
            <Settings className="mr-2 h-4 w-4" /> Configurer les requirements
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> CSV</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setAccOpen(true)} className="ml-auto bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Créer accréditation
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {accreds === null ? (
          <TableSkeleton cols={5} />
        ) : filteredAccreds.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune accréditation." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccreds.map((a) => {
                const sb = STATUSES.find((s) => s.value === a.status);
                const roleLabel = roles.find((r) => r.code === a.role_code)?.label ?? a.role_code ?? "—";
                const valid = a.docs.filter((d) => d.status === "valid").length;
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => setOpenId(a.id)}
                  >
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell><Badge variant="outline">{roleLabel}</Badge></TableCell>
                    <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                    <TableCell>
                      <span className="text-sm">{valid}/{a.docs.length}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(a.id); }}>Ouvrir</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Accred create dialog */}
      <Dialog open={accOpen} onOpenChange={setAccOpen}>
        <DialogContent>
          <form onSubmit={submitAccred}>
            <DialogHeader>
              <DialogTitle>Créer une accréditation</DialogTitle>
              <DialogDescription>Statut initial : Brouillon.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Rôle *</Label>
                <Select value={accForm.role_code} onValueChange={(v) => setAccForm({ ...accForm, role_code: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un rôle…" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Personne *</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}` : "Choisir…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[400px]" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher…" />
                      <CommandList>
                        <CommandEmpty>Aucun résultat.</CommandEmpty>
                        <CommandGroup>
                          {persons.slice(0, 200).map((p) => (
                            <CommandItem key={p.id} value={`${p.first_name} ${p.last_name}`}
                              onSelect={() => { setAccForm({ ...accForm, person_id: p.id }); setPickerOpen(false); }}>
                              {p.first_name} {p.last_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fl">Fonction</Label>
                <Input id="fl" value={accForm.function_label} onChange={(e) => setAccForm({ ...accForm, function_label: e.target.value })} />
              </div>
              {requiredDocs.length > 0 && (
                <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Documents requis pour ce rôle :</p>
                  <div className="flex flex-wrap gap-1">
                    {requiredDocs.map((dt) => {
                      const label = docTypes.find((t) => t.code === dt)?.label ?? dt;
                      return <Badge key={dt} variant="outline" className="text-xs">{label}</Badge>;
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">Créer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Drawer */}
      <Sheet open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle>{current.full_name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <AccredDrawerBody
                  accreditation={current}
                  completeness={completeness(current)}
                  docTypes={docTypes}
                  personDocs={drawerPersonDocs}
                  onUpload={uploadDoc}
                  onUploadPersonDoc={uploadPersonDoc}
                  onDocStatus={setDocStatus}
                  onSubmit={() => setAccredStatus(current, "submitted")}
                  onValidate={() => setAccredStatus(current, "validated")}
                  onReject={() => { setRejectReason(current.rejection_reason ?? ""); setRejectOpen(true); }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter l'accréditation</DialogTitle>
            <DialogDescription>Motif obligatoire pour traçabilité.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motif du rejet…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!current || !rejectReason.trim()) { toast.error("Motif requis"); return; }
                await setAccredStatus(current, "rejected", rejectReason.trim());
                setRejectOpen(false);
              }}
            >Rejeter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccredDrawerBody({
  accreditation, completeness, docTypes, personDocs,
  onUpload, onUploadPersonDoc, onDocStatus,
  onSubmit, onValidate, onReject,
}: {
  accreditation: Accreditation;
  completeness: number;
  docTypes: { code: string; label: string }[];
  personDocs: PersonDocument[];
  onUpload: (docType: string, url: string, fileName: string) => void;
  onUploadPersonDoc: (docType: string, url: string, fileName: string) => void;
  onDocStatus: (doc: AccDoc, status: string) => void;
  onSubmit: () => void;
  onValidate: () => void;
  onReject: () => void;
}) {
  const a = accreditation;
  const person = a.athlete ?? a.coach;

  // Map of accreditation docs by doc_type
  const accDocMap = new Map(a.docs.map((d) => [d.doc_type, d]));
  // Map of person docs by doc_type
  const personDocMap = new Map(personDocs.map((d) => [d.doc_type, d]));

  // All relevant doc types: from accreditation docs + person docs
  const allDocTypes = Array.from(new Set([
    ...a.docs.map((d) => d.doc_type),
    ...personDocs.map((d) => d.doc_type),
  ]));

  return (
    <>
      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-2 text-foreground">Personne</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Rôle</dt><dd>{a.role_code ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Fonction</dt><dd>{a.function_label ?? "—"}</dd></div>
          {a.athlete?.cosl_id && <div><dt className="text-xs text-muted-foreground">COSL ID</dt><dd className="font-mono text-xs">{a.athlete.cosl_id}</dd></div>}
          {a.coach?.role && <div><dt className="text-xs text-muted-foreground">Rôle coach</dt><dd>{a.coach.role}</dd></div>}
          <div><dt className="text-xs text-muted-foreground">Email</dt><dd>{person?.email ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Téléphone</dt><dd>{person?.phone ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Complétude</h3>
          <span className="text-sm font-medium">{completeness}%</span>
        </div>
        <Progress value={completeness} className="h-2" />
      </section>

      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3 text-foreground">Documents</h3>
        {allDocTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document pour cette accréditation.</p>
        ) : (
          <ul className="space-y-2">
            {allDocTypes.map((dt) => {
              const accDoc = accDocMap.get(dt);
              const personDoc = personDocMap.get(dt);
              const label = docTypes.find((t) => t.code === dt)?.label ?? dt;
              const sb = accDoc ? DOC_STATUSES[accDoc.status] : DOC_STATUSES.missing;
              return (
                <li key={dt} className="flex flex-col gap-2 rounded border border-border p-3 sm:flex-row sm:items-start">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium flex-1">{label}</p>
                      {accDoc ? (
                        <>
                          <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>
                          {accDoc.status !== "valid" && (
                            <Button size="icon" variant="ghost" onClick={() => onDocStatus(accDoc, "valid")} aria-label="Valider"><Check className="h-4 w-4 text-emerald-600" /></Button>
                          )}
                          {accDoc.status !== "rejected" && (
                            <Button size="icon" variant="ghost" onClick={() => onDocStatus(accDoc, "rejected")} aria-label="Rejeter"><X className="h-4 w-4 text-red-600" /></Button>
                          )}
                        </>
                      ) : personDoc ? (
                        <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Fourni (personne)</Badge>
                      ) : (
                        <Badge className="bg-slate-200 text-foreground hover:bg-slate-200">Manquant</Badge>
                      )}
                    </div>
                    {/* Show person doc link if available */}
                    {personDoc && (
                      <div className="text-xs text-muted-foreground">
                        📄 {personDoc.file_name}
                        {personDoc.file_url && (
                          <a href={personDoc.file_url} target="_blank" rel="noreferrer" className="ml-2 text-[var(--lux-blue)] hover:underline">Voir</a>
                        )}
                      </div>
                    )}
                    {/* Upload to accreditation_documents */}
                    <FileUpload
                      bucket="documents"
                      path={`accreditations/${a.id}/${dt}/${Date.now()}_`}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      currentUrl={accDoc?.file_url ?? null}
                      currentName={accDoc?.file_name ?? null}
                      onUploaded={(url, fileName) => onUpload(dt, url, fileName)}
                    />
                    {/* Also allow uploading to person_documents */}
                    {!personDoc && (
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-1">Ajouter à la fiche personne :</p>
                        <FileUpload
                          bucket="documents"
                          path={`persons/${a.athlete_id ?? a.coach_id}/${dt}/${Date.now()}_`}
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onUploaded={(url, fileName) => onUploadPersonDoc(dt, url, fileName)}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {a.rejection_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Motif du rejet :</strong> {a.rejection_reason}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSubmit} disabled={a.status !== "draft"} className="bg-amber-500 hover:bg-amber-600">Soumettre</Button>
        <Button onClick={onValidate} disabled={!["submitted", "rejected"].includes(a.status)} className="bg-emerald-600 hover:bg-emerald-700">Valider</Button>
        <Button onClick={onReject} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">Rejeter</Button>
      </div>
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "emerald" | "amber" | "red" }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-700" :
    tone === "amber" ? "text-amber-700" :
    tone === "red" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</p>
    </div>
  );
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success("Export généré");
}