import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Download, Upload, FileText, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useHashTab } from "@/hooks/useHashTab";

export const Route = createFileRoute("/_authenticated/games/$id/accreditations")({
  component: GameAccreditationsPage,
});

const STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "draft", label: "Brouillon", cls: "bg-slate-200 text-slate-700" },
  { value: "submitted", label: "Soumise", cls: "bg-amber-100 text-amber-700" },
  { value: "validated", label: "Validée", cls: "bg-emerald-100 text-emerald-700" },
  { value: "rejected", label: "Rejetée", cls: "bg-red-100 text-red-700" },
  { value: "produced", label: "Produite", cls: "bg-indigo-100 text-indigo-700" },
  { value: "delivered", label: "Délivrée", cls: "bg-blue-100 text-blue-800" },
];

const CATEGORIES: { value: string; label: string }[] = [
  { value: "athlete", label: "Athlète" },
  { value: "coach", label: "Coach" },
  { value: "official", label: "Officiel" },
  { value: "medical", label: "Médical" },
  { value: "press", label: "Presse" },
  { value: "vip", label: "VIP" },
];

const DOC_STATUSES: Record<string, { label: string; cls: string }> = {
  missing: { label: "Manquant", cls: "bg-slate-200 text-slate-700" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  valid: { label: "Valide", cls: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Expiré", cls: "bg-red-100 text-red-700" },
  rejected: { label: "Rejeté", cls: "bg-red-100 text-red-700" },
};

type AccType = {
  id: string; game_id: string; category: string; type_code: string;
  description: string | null; required_documents: string[] | null;
  valid_from: string | null; valid_until: string | null;
};
type Athlete = { id: string; first_name: string; last_name: string; cosl_id: string; email: string | null; phone: string | null };
type Coach = { id: string; first_name: string; last_name: string; role: string; email: string | null; phone: string | null };
type AccDoc = {
  id: string; accreditation_id: string; doc_type: string;
  file_name: string; file_url: string | null; status: string; uploaded_at: string;
};
type Accreditation = {
  id: string; game_id: string; accreditation_type_id: string;
  athlete_id: string | null; coach_id: string | null;
  full_name: string; function_label: string | null;
  status: string; rejection_reason: string | null; notes: string | null;
  type: AccType | null;
  athlete: Athlete | null;
  coach: Coach | null;
  docs: AccDoc[];
};

function GameAccreditationsPage() {
  const { id: gameId } = Route.useParams();
  const [tab, setTab] = useHashTab("list");
  const [types, setTypes] = useState<AccType[] | null>(null);
  const [accreds, setAccreds] = useState<Accreditation[] | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [game, setGame] = useState<{ name: string; short_name: string | null } | null>(null);

  // Filters
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Type dialog
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<AccType | null>(null);
  const [typeForm, setTypeForm] = useState({
    category: "athlete", type_code: "", description: "",
    required_documents: "", valid_from: "", valid_until: "",
  });

  // Accred create dialog
  const [accOpen, setAccOpen] = useState(false);
  const [accType, setAccType] = useState<"athlete" | "coach">("athlete");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accForm, setAccForm] = useState({ entity_id: "", type_id: "", function_label: "" });

  // Drawer
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setTypes(null); setAccreds(null);
    const [tRes, aRes, athRes, coachRes, gRes] = await Promise.all([
      supabase.from("accreditation_types").select("*").eq("game_id", gameId).order("category"),
      supabase.from("accreditations")
        .select("*, type:accreditation_types(*), athlete:athletes(id,first_name,last_name,cosl_id,email,phone), coach:coaches(id,first_name,last_name,role,email,phone), docs:accreditation_documents(*)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase.from("athletes").select("id,first_name,last_name,cosl_id,email,phone").eq("is_active", true).order("last_name"),
      supabase.from("coaches").select("id,first_name,last_name,role,email,phone").eq("is_active", true).order("last_name"),
      supabase.from("games").select("name,short_name").eq("id", gameId).maybeSingle(),
    ]);
    setTypes((tRes.data ?? []) as AccType[]);
    setAccreds(((aRes.data ?? []) as unknown) as Accreditation[]);
    setAthletes((athRes.data ?? []) as Athlete[]);
    setCoaches((coachRes.data ?? []) as Coach[]);
    setGame((gRes.data ?? null) as { name: string; short_name: string | null } | null);
  };

  useEffect(() => { load(); }, [gameId]);

  const completeness = (a: Accreditation) => {
    const required = a.type?.required_documents ?? [];
    const total = required.length || a.docs.length;
    if (total === 0) return 0;
    const valid = a.docs.filter((d) => d.status === "valid" && (required.length === 0 || required.includes(d.doc_type))).length;
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
    return accreds.filter((a) => {
      if (catFilter !== "all" && a.type?.category !== catFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [accreds, catFilter, statusFilter]);

  // ==== Types CRUD ====
  const openCreateType = () => {
    setEditingType(null);
    setTypeForm({ category: "athlete", type_code: "", description: "", required_documents: "", valid_from: "", valid_until: "" });
    setTypeOpen(true);
  };
  const openEditType = (t: AccType) => {
    setEditingType(t);
    setTypeForm({
      category: t.category,
      type_code: t.type_code,
      description: t.description ?? "",
      required_documents: (t.required_documents ?? []).join(", "),
      valid_from: t.valid_from ?? "",
      valid_until: t.valid_until ?? "",
    });
    setTypeOpen(true);
  };
  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.type_code.trim()) { toast.error("Code requis"); return; }
    const payload = {
      game_id: gameId,
      category: typeForm.category,
      type_code: typeForm.type_code.trim(),
      description: typeForm.description.trim() || null,
      required_documents: typeForm.required_documents
        .split(",").map((s) => s.trim()).filter(Boolean),
      valid_from: typeForm.valid_from || null,
      valid_until: typeForm.valid_until || null,
    };
    const { error } = editingType
      ? await supabase.from("accreditation_types").update(payload).eq("id", editingType.id)
      : await supabase.from("accreditation_types").insert(payload);
    if (error) { toast.error("Échec", { description: error.message }); return; }
    toast.success(editingType ? "Type modifié" : "Type ajouté");
    setTypeOpen(false); load();
  };
  const removeType = async (t: AccType) => {
    const { error } = await supabase.from("accreditation_types").delete().eq("id", t.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Type supprimé"); load(); }
  };

  // ==== Accreditation create ====
  const submitAccred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accForm.entity_id || !accForm.type_id) {
      toast.error("Personne et type requis"); return;
    }
    const person = accType === "athlete"
      ? athletes.find((a) => a.id === accForm.entity_id)
      : coaches.find((c) => c.id === accForm.entity_id);
    if (!person) return;
    const payload = {
      game_id: gameId,
      accreditation_type_id: accForm.type_id,
      athlete_id: accType === "athlete" ? accForm.entity_id : null,
      coach_id: accType === "coach" ? accForm.entity_id : null,
      full_name: `${person.first_name} ${person.last_name}`,
      function_label: accForm.function_label.trim() || null,
      status: "draft",
    };
    const { error } = await supabase.from("accreditations").insert(payload);
    if (error) { toast.error("Échec", { description: error.message }); return; }
    toast.success("Accréditation créée");
    setAccOpen(false);
    setAccForm({ entity_id: "", type_id: "", function_label: "" });
    load();
  };

  // ==== Drawer actions ====
  const current = (accreds ?? []).find((a) => a.id === openId) ?? null;

  const uploadDoc = async (docType: string, file: File) => {
    if (!current) return;
    const path = `${gameId}/${current.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("accreditation-docs").upload(path, file, { upsert: false });
    if (upErr) { toast.error("Upload échoué", { description: upErr.message }); return; }
    const { data: pub } = supabase.storage.from("accreditation-docs").getPublicUrl(path);
    // Upsert document row by accreditation_id + doc_type
    const existing = current.docs.find((d) => d.doc_type === docType);
    if (existing) {
      await supabase.from("accreditation_documents").update({
        file_name: file.name, file_url: pub.publicUrl, status: "pending",
      }).eq("id", existing.id);
    } else {
      await supabase.from("accreditation_documents").insert({
        accreditation_id: current.id, doc_type: docType,
        file_name: file.name, file_url: pub.publicUrl, status: "pending",
      });
    }
    toast.success("Document téléversé");
    load();
  };

  const setDocStatus = async (doc: AccDoc, status: string) => {
    const { error } = await supabase.from("accreditation_documents").update({ status }).eq("id", doc.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Statut document mis à jour"); load(); }
  };

  const setAccredStatus = async (acc: Accreditation, status: string, reason?: string) => {
    const patch: { status: string; submitted_at?: string; validated_at?: string; rejection_reason?: string | null } = { status };
    if (status === "submitted") patch.submitted_at = new Date().toISOString();
    if (status === "validated") { patch.validated_at = new Date().toISOString(); patch.rejection_reason = null; }
    if (status === "rejected") patch.rejection_reason = reason ?? null;
    const { error } = await supabase.from("accreditations").update(patch).eq("id", acc.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Statut mis à jour"); load(); }
  };

  // Export
  const exportCsv = () => {
    if (!accreds || !game) return;
    const header = ["Catégorie", "Type", "Nom complet", "Fonction", "Statut", "Complétude %"];
    const rows = accreds.map((a) => [
      a.type?.category ?? "", a.type?.type_code ?? "",
      a.full_name, a.function_label ?? "", a.status, String(completeness(a)),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`accreditations_${(game.short_name ?? game.name).replace(/\W+/g, "_")}.csv`, "text/csv", "\ufeff" + csv);
  };

  const exportXml = () => {
    if (!accreds || !game) return;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<accreditations game="${escapeXml(game.name)}">
${accreds.map((a) => `  <accreditation status="${a.status}">
    <category>${escapeXml(a.type?.category ?? "")}</category>
    <type>${escapeXml(a.type?.type_code ?? "")}</type>
    <fullName>${escapeXml(a.full_name)}</fullName>
    <function>${escapeXml(a.function_label ?? "")}</function>
    <completeness>${completeness(a)}</completeness>
  </accreditation>`).join("\n")}
</accreditations>`;
    download(`accreditations_${(game.short_name ?? game.name).replace(/\W+/g, "_")}.xml`, "application/xml", xml);
  };

  const selectedEntity = accType === "athlete"
    ? athletes.find((a) => a.id === accForm.entity_id)
    : coaches.find((c) => c.id === accForm.entity_id);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total accréditations" value={kpi.total} />
        <Kpi label="Validées" value={`${kpi.validated} (${kpi.validatedPct}%)`} tone="emerald" />
        <Kpi label="En attente" value={kpi.pending} tone="amber" />
        <Kpi label="Rejetées" value={kpi.rejected} tone="red" />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> CSV</Button>
        <Button variant="outline" onClick={exportXml}><Download className="mr-2 h-4 w-4" /> XML</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Liste des accréditations</TabsTrigger>
          <TabsTrigger value="types">Types d'accréditation</TabsTrigger>
        </TabsList>

        {/* Accreditations list */}
        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setAccOpen(true)} className="ml-auto bg-indigo-500 hover:bg-indigo-600">
              <Plus className="mr-2 h-4 w-4" /> Créer accréditation
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            {accreds === null ? (
              <TableSkeleton cols={6} />
            ) : filteredAccreds.length === 0 ? (
              <div className="p-6"><EmptyState message="Aucune accréditation." /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personne</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccreds.map((a) => {
                    const sb = STATUSES.find((s) => s.value === a.status);
                    const cat = CATEGORIES.find((c) => c.value === a.type?.category);
                    const required = a.type?.required_documents ?? [];
                    const total = required.length || a.docs.length;
                    const valid = a.docs.filter((d) => d.status === "valid").length;
                    return (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => setOpenId(a.id)}
                      >
                        <TableCell className="font-medium">{a.full_name}</TableCell>
                        <TableCell>{cat ? <Badge variant="outline">{cat.label}</Badge> : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{a.type?.type_code ?? "—"}</TableCell>
                        <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                        <TableCell>
                          <span className="text-sm">{valid}/{total}</span>
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
        </TabsContent>

        {/* Types */}
        <TabsContent value="types" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateType} className="bg-indigo-500 hover:bg-indigo-600">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un type
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white">
            {types === null ? (
              <TableSkeleton cols={5} />
            ) : types.length === 0 ? (
              <div className="p-6"><EmptyState message="Aucun type d'accréditation défini." /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Documents requis</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((t) => {
                    const cat = CATEGORIES.find((c) => c.value === t.category);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{cat ? <Badge variant="outline">{cat.label}</Badge> : t.category}</TableCell>
                        <TableCell className="font-mono text-xs">{t.type_code}</TableCell>
                        <TableCell className="text-slate-600">{t.description ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">
                          <div className="flex flex-wrap gap-1">
                            {(t.required_documents ?? []).map((d) => (
                              <Badge key={d} variant="outline" className="font-normal">{d}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditType(t)} aria-label="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeType(t)} aria-label="Supprimer">
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
        </TabsContent>
      </Tabs>

      {/* Type dialog */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitType}>
            <DialogHeader>
              <DialogTitle>{editingType ? "Modifier le type" : "Ajouter un type"}</DialogTitle>
              <DialogDescription>Documents requis séparés par des virgules.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Catégorie *</Label>
                  <Select value={typeForm.category} onValueChange={(v) => setTypeForm({ ...typeForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tcode">Code *</Label>
                  <Input id="tcode" value={typeForm.type_code} onChange={(e) => setTypeForm({ ...typeForm, type_code: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tdesc">Description</Label>
                <Textarea id="tdesc" rows={2} value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="treq">Documents requis (séparés par virgules)</Label>
                <Input id="treq" placeholder="passport, photo, certificat_medical" value={typeForm.required_documents} onChange={(e) => setTypeForm({ ...typeForm, required_documents: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valide depuis</Label>
                  <Input type="date" value={typeForm.valid_from} onChange={(e) => setTypeForm({ ...typeForm, valid_from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valide jusqu'à</Label>
                  <Input type="date" value={typeForm.valid_until} onChange={(e) => setTypeForm({ ...typeForm, valid_until: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTypeOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600">{editingType ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                <Label>Type *</Label>
                <Select value={accForm.type_id} onValueChange={(v) => setAccForm({ ...accForm, type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {(types ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.type_code} ({t.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <RadioGroup value={accType} onValueChange={(v) => { setAccType(v as "athlete" | "coach"); setAccForm({ ...accForm, entity_id: "" }); }} className="flex gap-6">
                <div className="flex items-center gap-2"><RadioGroupItem id="ath" value="athlete" /><Label htmlFor="ath">Athlète</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem id="co" value="coach" /><Label htmlFor="co">Encadrant</Label></div>
              </RadioGroup>
              <div className="space-y-1.5">
                <Label>Personne *</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {selectedEntity ? `${selectedEntity.first_name} ${selectedEntity.last_name}` : "Choisir…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[400px]" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher…" />
                      <CommandList>
                        <CommandEmpty>Aucun résultat.</CommandEmpty>
                        <CommandGroup>
                          {(accType === "athlete" ? athletes : coaches).slice(0, 200).map((p) => (
                            <CommandItem key={p.id} value={`${p.first_name} ${p.last_name}`}
                              onSelect={() => { setAccForm({ ...accForm, entity_id: p.id }); setPickerOpen(false); }}>
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600">Créer</Button>
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
                  onUpload={uploadDoc}
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
  accreditation, completeness, onUpload, onDocStatus,
  onSubmit, onValidate, onReject,
}: {
  accreditation: Accreditation;
  completeness: number;
  onUpload: (docType: string, file: File) => void;
  onDocStatus: (doc: AccDoc, status: string) => void;
  onSubmit: () => void;
  onValidate: () => void;
  onReject: () => void;
}) {
  const a = accreditation;
  const person = a.athlete ?? a.coach;
  const required = a.type?.required_documents ?? [];
  const docMap = new Map(a.docs.map((d) => [d.doc_type, d]));
  const allDocTypes = required.length
    ? required
    : Array.from(new Set(a.docs.map((d) => d.doc_type)));

  return (
    <>
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-2 text-slate-700">Personne</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-slate-500">Type</dt><dd>{a.athlete_id ? "Athlète" : "Encadrant"}</dd></div>
          <div><dt className="text-xs text-slate-500">Fonction</dt><dd>{a.function_label ?? "—"}</dd></div>
          {a.athlete?.cosl_id && <div><dt className="text-xs text-slate-500">COSL ID</dt><dd className="font-mono text-xs">{a.athlete.cosl_id}</dd></div>}
          {a.coach?.role && <div><dt className="text-xs text-slate-500">Rôle</dt><dd>{a.coach.role}</dd></div>}
          <div><dt className="text-xs text-slate-500">Email</dt><dd>{person?.email ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Téléphone</dt><dd>{person?.phone ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Complétude</h3>
          <span className="text-sm font-medium">{completeness}%</span>
        </div>
        <Progress value={completeness} className="h-2" />
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-3 text-slate-700">Documents</h3>
        {allDocTypes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun document requis pour ce type.</p>
        ) : (
          <ul className="space-y-2">
            {allDocTypes.map((dt) => {
              const doc = docMap.get(dt);
              const sb = doc ? DOC_STATUSES[doc.status] : DOC_STATUSES.missing;
              return (
                <li key={dt} className="flex items-center gap-3 rounded border border-slate-200 p-3">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{dt}</p>
                    {doc?.file_name && (
                      <p className="text-xs text-slate-500 truncate">
                        {doc.file_url ? <a href={doc.file_url} target="_blank" rel="noreferrer" className="hover:underline">{doc.file_name}</a> : doc.file_name}
                      </p>
                    )}
                  </div>
                  <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) onUpload(dt, f); e.target.value = "";
                    }} />
                    <span className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2 text-xs hover:bg-slate-50">
                      <Upload className="mr-1 h-3 w-3" /> Téléverser
                    </span>
                  </label>
                  {doc && doc.status !== "valid" && (
                    <Button size="icon" variant="ghost" onClick={() => onDocStatus(doc, "valid")} aria-label="Valider"><Check className="h-4 w-4 text-emerald-600" /></Button>
                  )}
                  {doc && doc.status !== "rejected" && (
                    <Button size="icon" variant="ghost" onClick={() => onDocStatus(doc, "rejected")} aria-label="Rejeter"><X className="h-4 w-4 text-red-600" /></Button>
                  )}
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
    tone === "red" ? "text-red-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</p>
    </div>
  );
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success("Export généré");
}
