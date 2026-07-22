import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Trash2, Download, FileText, Check, X, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FileUpload } from "@/components/FileUpload";
import { computeRequiredDocs } from "@/lib/conformity-utils";
import { useTypeGroup, clsForCode } from "@/hooks/useTypeItems";
import type { PersonDocument } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/games/$id/accreditations")({
  component: GameAccreditationsPage,
});

type AccDoc = {
  id: string; accreditation_id: string; doc_type: string;
  file_name: string; file_url: string | null; status: string; uploaded_at: string;
};
type Accreditation = {
  id: string; game_id: string; accreditation_type_id: string | null;
  person_id: string | null;
  athlete_id: string | null; coach_id: string | null;
  full_name: string; function_label: string | null;
  status: string; rejection_reason: string | null; notes: string | null;
  role_code: string | null;
  docs: AccDoc[];
};

function GameAccreditationsPage() {
  const { id: gameId } = Route.useParams();
  const accredStatusesHook = useTypeGroup("accreditation_statuses");
  const docStatusesHook = useTypeGroup("document_statuses");
  const [accreds, setAccreds] = useState<Accreditation[] | null>(null);
  const [game, setGame] = useState<{ name: string; short_name: string | null } | null>(null);
  const [roles, setRoles] = useState<{ code: string; label: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ code: string; label: string }[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Drawer
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [drawerPersonDocs, setDrawerPersonDocs] = useState<PersonDocument[]>([]);
  const [drawerPersonId, setDrawerPersonId] = useState<string | null>(null);
  const [drawerRequiredDocs, setDrawerRequiredDocs] = useState<string[]>([]);

  const load = async () => {
    setAccreds(null);
    const [aRes, gRes, rolesRes, dtRes] = await Promise.all([
      supabase.from("accreditations")
        .select("*, docs:accreditation_documents(*)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase.from("games").select("name,short_name").eq("id", gameId).maybeSingle(),
      supabase.from("app_type_items").select("code,label").eq("group_key", "accreditation_categories").order("sort_order"),
      supabase.from("app_type_items").select("code,label").eq("group_key", "document_types").order("sort_order"),
    ]);
    setAccreds(((aRes.data ?? []) as unknown) as Accreditation[]);
    setGame((gRes.data ?? null) as { name: string; short_name: string | null } | null);
    setRoles((rolesRes.data ?? []) as { code: string; label: string }[]);
    setDocTypes((dtRes.data ?? []) as { code: string; label: string }[]);
  };

  useEffect(() => { load(); }, [gameId]);

  const completeness = (a: Accreditation) => {
    // Count required docs that are satisfied (either by accreditation_documents
    // or by person_documents with a valid/pending status)
    if (drawerRequiredDocs.length === 0 && a.docs.length === 0) return 0;
    const total = drawerRequiredDocs.length > 0 ? drawerRequiredDocs.length : a.docs.length;
    if (total === 0) return 0;
    // Valid accreditations docs
    const validAccDocs = new Set(
      a.docs.filter((d) => d.status === "valid").map((d) => d.doc_type)
    );
    // Valid/pending person docs (count as provided)
    const providedPersonDocs = new Set(
      drawerPersonDocs
        .filter((d) => d.status === "valid" || d.status === "pending")
        .map((d) => d.doc_type)
    );
    // Count satisfied required docs
    const requiredCodes = drawerRequiredDocs.length > 0 ? drawerRequiredDocs : a.docs.map((d) => d.doc_type);
    const satisfied = requiredCodes.filter(
      (code) => validAccDocs.has(code) || providedPersonDocs.has(code)
    ).length;
    return Math.round((satisfied / total) * 100);
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

  // ==== Drawer actions ====
  const current = (accreds ?? []).find((a) => a.id === openId) ?? null;

  // Load person documents + required docs for the drawer, then auto-link
  useEffect(() => {
    if (!current) return;

    const run = async () => {
      // Determine person_id: try direct, then fallback via athlete_profiles
      let pid = current.person_id;
      if (!pid && current.athlete_id) {
        // Fallback: look up person_id from athlete_profiles
        const { data: ap } = await supabase
          .from("athlete_profiles")
          .select("person_id")
          .eq("legacy_athlete_id", current.athlete_id)
          .maybeSingle();
        pid = (ap as { person_id?: string | null } | null)?.person_id ?? null;

        // If found, update the accreditation to set person_id for future use
        if (pid) {
          await supabase.from("accreditations").update({ person_id: pid }).eq("id", current.id);
        }
      }

      if (!pid) {
        setDrawerPersonId(null);
        setDrawerPersonDocs([]);
        setDrawerRequiredDocs([]);
        return;
      }

      setDrawerPersonId(pid);

      // Load required docs + person docs in parallel
      const reqPromise = current.role_code
        ? computeRequiredDocs(gameId, current.role_code)
        : Promise.resolve([]);

      const docsPromise = supabase
        .from("person_documents")
        .select("*")
        .eq("person_id", pid)
        .order("created_at", { ascending: false });

      const [reqDocs, docsRes] = await Promise.all([reqPromise, docsPromise]);
      const reqCodes = reqDocs.map((d) => d.doc_type_code);
      setDrawerRequiredDocs(reqCodes);

      const personDocs = (docsRes.data ?? []) as PersonDocument[];
      setDrawerPersonDocs(personDocs);

      // Auto-link: for each required doc that the person already has but
      // is not yet in accreditation_documents, create the link automatically
      const existingAccDocTypes = new Set(current.docs.map((d) => d.doc_type));
      const personDocTypes = new Set(personDocs.map((d) => d.doc_type));
      const toLink = reqCodes.filter(
        (code) => !existingAccDocTypes.has(code) && personDocTypes.has(code),
      );

      if (toLink.length > 0) {
        const inserts = toLink.map((docType) => {
          const pd = personDocs.find((d) => d.doc_type === docType);
          if (!pd) return null;
          return {
            accreditation_id: current.id,
            doc_type: docType,
            file_name: pd.file_name,
            file_url: pd.file_url,
            status: pd.status === "valid" ? "valid" : "pending",
            uploaded_at: new Date().toISOString(),
          };
        }).filter((x): x is NonNullable<typeof x> => x !== null);

        if (inserts.length > 0) {
          await supabase.from("accreditation_documents").insert(inserts);
          load();
        }
      }
    };

    run();
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

  // Link a person_document to this accreditation (creates an accreditation_document
  // referencing the existing file from the person's documents)
  const linkPersonDoc = async (docType: string) => {
    if (!current) return;
    const personDoc = drawerPersonDocs.find((d) => d.doc_type === docType);
    if (!personDoc) return;
    const existing = current.docs.find((d) => d.doc_type === docType);
    const payload = {
      accreditation_id: current.id,
      doc_type: docType,
      file_name: personDoc.file_name,
      file_url: personDoc.file_url,
      status: personDoc.status === "valid" ? "valid" : "pending",
      uploaded_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from("accreditation_documents").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("accreditation_documents").insert(payload);
    }
    toast.success("Document de la personne lié à l'accréditation");
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
    const header = ["Rôle", "Nom complet", "Statut", "Complétude %"];
    const rows = accreds.map((a) => [
      a.role_code ?? "", a.full_name, a.status, String(completeness(a)),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`accreditations_${(game.short_name ?? game.name).replace(/\W+/g, "_")}.csv`, "text/csv", "\ufeff" + csv);
  };

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

      <p className="text-sm text-muted-foreground">
        Les accréditations sont créées automatiquement lorsqu'une personne est ajoutée aux sélections.
      </p>

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
            {accredStatusesHook.items.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {accreds === null ? (
          <TableSkeleton cols={5} />
        ) : filteredAccreds.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune accréditation. Les accréditations sont créées automatiquement depuis les sélections." /></div>
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
                const sb = accredStatusesHook.findItem(a.status);
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
                    <TableCell>{sb && <Badge className={`${clsForCode(a.status)} hover:${clsForCode(a.status)}`}>{sb.label}</Badge>}</TableCell>
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
                  requiredDocCodes={drawerRequiredDocs}
                  personDocs={drawerPersonDocs}
                  getDocStatusLabel={docStatusesHook.getLabel}
                  onUpload={uploadDoc}
                  onUploadPersonDoc={uploadPersonDoc}
                  onLinkPersonDoc={linkPersonDoc}
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
  accreditation, completeness, docTypes, requiredDocCodes, personDocs,
  getDocStatusLabel,
  onUpload, onUploadPersonDoc, onLinkPersonDoc, onDocStatus,
  onSubmit, onValidate, onReject,
}: {
  accreditation: Accreditation;
  completeness: number;
  docTypes: { code: string; label: string }[];
  requiredDocCodes: string[];
  personDocs: PersonDocument[];
  getDocStatusLabel: (code: string | null | undefined) => string;
  onUpload: (docType: string, url: string, fileName: string) => void;
  onUploadPersonDoc: (docType: string, url: string, fileName: string) => void;
  onLinkPersonDoc: (docType: string) => void;
  onDocStatus: (doc: AccDoc, status: string) => void;
  onSubmit: () => void;
  onValidate: () => void;
  onReject: () => void;
}) {
  const a = accreditation;

  const accDocMap = new Map(a.docs.map((d) => [d.doc_type, d]));
  const personDocMap = new Map(personDocs.map((d) => [d.doc_type, d]));

  // All relevant doc types: required docs + already uploaded docs
  const allDocCodes = Array.from(new Set([
    ...requiredDocCodes,
    ...a.docs.map((d) => d.doc_type),
    ...personDocs.map((d) => d.doc_type),
  ]));

  return (
    <>
      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-2 text-foreground">Personne</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Rôle</dt><dd>{a.role_code ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Statut</dt><dd>{a.status}</dd></div>
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
        {allDocCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun document requis pour ce rôle. Configurez les requirements dans la page de configuration.
          </p>
        ) : (
          <ul className="space-y-2">
            {allDocCodes.map((dt) => {
              const accDoc = accDocMap.get(dt);
              const personDoc = personDocMap.get(dt);
              const label = docTypes.find((t) => t.code === dt)?.label ?? dt;
              const isRequired = requiredDocCodes.includes(dt);
              const personDocCls = personDoc ? clsForCode(personDoc.status) : "";
              return (
                <li key={dt} className="flex flex-col gap-2 rounded border border-border p-3 sm:flex-row sm:items-start">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium flex-1">
                        {label}
                        {isRequired && <span className="ml-1 text-xs text-red-600">*</span>}
                      </p>
                      {accDoc ? (
                        <>
                          <Badge className={`${clsForCode(accDoc.status)} hover:${clsForCode(accDoc.status)}`}>
                            {getDocStatusLabel(accDoc.status)}
                          </Badge>
                          {accDoc.status !== "valid" && (
                            <Button size="icon" variant="ghost" onClick={() => onDocStatus(accDoc, "valid")} aria-label="Valider"><Check className="h-4 w-4 text-emerald-600" /></Button>
                          )}
                          {accDoc.status !== "rejected" && (
                            <Button size="icon" variant="ghost" onClick={() => onDocStatus(accDoc, "rejected")} aria-label="Rejeter"><X className="h-4 w-4 text-red-600" /></Button>
                          )}
                        </>
                      ) : personDoc ? (
                        <>
                          <Badge className={`${personDocCls} hover:${personDocCls}`}>
                            {getDocStatusLabel(personDoc.status)}
                          </Badge>
                          <span className="text-xs text-sky-700 font-medium">Fourni par la personne</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => onLinkPersonDoc(dt)}
                          >
                            Lier à l'accréditation
                          </Button>
                        </>
                      ) : (
                        <Badge className="bg-slate-200 text-foreground hover:bg-slate-200">Manquant</Badge>
                      )}
                    </div>
                    {/* Show person doc info */}
                    {personDoc && (
                      <div className="text-xs text-muted-foreground">
                        📄 {personDoc.file_name}
                        {personDoc.file_url && (
                          <a href={personDoc.file_url} target="_blank" rel="noreferrer" className="ml-2 text-[var(--lux-blue)] hover:underline">Voir</a>
                        )}
                        <span className="ml-2">
                          ({getDocStatusLabel(personDoc.status)})
                        </span>
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
                    {/* Also allow uploading to person_documents if not already present */}
                    {!personDoc && (
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-1">Ajouter à la fiche personne :</p>
                        <FileUpload
                          bucket="documents"
                          path={`persons/${a.person_id ?? a.athlete_id ?? a.coach_id}/${dt}/${Date.now()}_`}
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