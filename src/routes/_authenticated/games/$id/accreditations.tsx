import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Trash2, Download, FileText, Check, X, Search, Settings, Plus } from "lucide-react";
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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { computeRequiredDocs } from "@/lib/conformity-utils";
import { useTypeGroup, clsForCode } from "@/hooks/useTypeItems";
import { resolveAccreditationCategory } from "@/lib/role-mapping";
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

    // 1. Fetch all selections for this game (athletes + persons)
    const [selRes, gRes, rolesRes, dtRes] = await Promise.all([
      supabase.from("selections")
        .select("athlete_id, person_id, status")
        .eq("game_id", gameId)
        .in("status", ["pre_selected", "selected", "reserve"]),
      supabase.from("games").select("name,short_name").eq("id", gameId).maybeSingle(),
      supabase.from("app_type_items").select("code,label").eq("group_key", "accreditation_categories").order("sort_order"),
      supabase.from("app_type_items").select("code,label").eq("group_key", "document_types").order("sort_order"),
    ]);

    // 2. Fetch existing accreditations
    const aRes = await supabase.from("accreditations")
      .select("*, docs:accreditation_documents(*)")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false });

    // 3. Build a set of existing person_ids in accreditations
    const existingPids = new Set(
      ((aRes.data ?? []) as Accreditation[]).map((a) => a.person_id).filter(Boolean) as string[],
    );

    // 4. For each selection, ensure an accreditation exists
    const selections = (selRes.data ?? []) as unknown as Array<{
      athlete_id: string | null;
      person_id: string | null;
      status: string;
    }>;

    const toCreate: { game_id: string; person_id: string; full_name: string; status: string; role_code: string }[] = [];

    for (const sel of selections) {
      let pid = sel.person_id;
      let fullName = "";
      let roleCode = "athlete";

      if (sel.athlete_id) {
        // Athlete selection — get person_id + name
        const { data: ap } = await supabase
          .from("athlete_profiles")
          .select("person_id")
          .eq("legacy_athlete_id", sel.athlete_id)
          .maybeSingle();
        pid = (ap as { person_id?: string | null } | null)?.person_id ?? null;

        // Fallback: athletes table
        if (!pid) {
          const { data: ath } = await supabase
            .from("athletes")
            .select("person_id, first_name, last_name")
            .eq("id", sel.athlete_id)
            .maybeSingle();
          pid = (ath as { person_id?: string | null } | null)?.person_id ?? null;
        }

        // Get name from persons
        if (pid) {
          const { data: p } = await supabase
            .from("persons")
            .select("first_name, last_name")
            .eq("id", pid)
            .maybeSingle();
          if (p) {
            fullName = `${(p as { first_name: string }).first_name} ${(p as { last_name: string }).last_name}`;
          }
        }
      } else if (sel.person_id) {
        // Person-based selection (coach/fed member)
        pid = sel.person_id;
        const { data: p } = await supabase
          .from("persons")
          .select("first_name, last_name")
          .eq("id", sel.person_id)
          .maybeSingle();
        if (p) {
          fullName = `${(p as { first_name: string }).first_name} ${(p as { last_name: string }).last_name}`;
        }
        // Résoudre le rôle via role_accreditation_mapping :
        // 1. Essayer coach_profiles (utiliser .limit(1) au lieu de .maybeSingle()
        //    pour gérer le cas de plusieurs profils actifs)
        const { data: cpRows } = await supabase
          .from("coach_profiles")
          .select("role")
          .eq("person_id", sel.person_id)
          .eq("is_active", true)
          .limit(1);
        if (cpRows && cpRows.length > 0) {
          const coachRole = (cpRows[0] as { role: string }).role;
          const resolved = await resolveAccreditationCategory("coach_roles", coachRole);
          roleCode = resolved ?? "coach";
        } else {
          // 2. Essayer federation_member_profiles
          const { data: fmRows } = await supabase
            .from("federation_member_profiles")
            .select("role")
            .eq("person_id", sel.person_id)
            .eq("is_active", true)
            .limit(1);
          if (fmRows && fmRows.length > 0) {
            const fmRole = (fmRows[0] as { role: string }).role;
            const resolved = await resolveAccreditationCategory("federation_member_roles", fmRole);
            roleCode = resolved ?? "official";
          }
        }
      }

      if (pid && fullName && !existingPids.has(pid)) {
        toCreate.push({
          game_id: gameId,
          person_id: pid,
          full_name: fullName,
          status: "draft",
          role_code: roleCode,
        });
      }
    }

    // 5. Insert missing accreditations
    if (toCreate.length > 0) {
      await supabase.from("accreditations").insert(toCreate);
      // Reload to get the fresh data
      const aRes2 = await supabase.from("accreditations")
        .select("*, docs:accreditation_documents(*)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false });
      setAccreds(((aRes2.data ?? []) as unknown) as Accreditation[]);
    } else {
      setAccreds(((aRes.data ?? []) as unknown) as Accreditation[]);
    }

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

  // Load person documents + required docs for the drawer
  useEffect(() => {
    if (!current) return;

    const run = async () => {
      // Determine person_id: try direct, then fallback via athlete_profiles
      let pid = current.person_id;
      if (!pid && current.athlete_id) {
        const { data: ap } = await supabase
          .from("athlete_profiles")
          .select("person_id")
          .eq("legacy_athlete_id", current.athlete_id)
          .maybeSingle();
        pid = (ap as { person_id?: string | null } | null)?.person_id ?? null;
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

      const reqPromise = current.role_code
        ? computeRequiredDocs(gameId, current.role_code)
        : Promise.resolve([]);

      const docsPromise = supabase
        .from("person_documents")
        .select("*")
        .eq("person_id", pid)
        .order("created_at", { ascending: false });

      const [reqDocs, docsRes] = await Promise.all([reqPromise, docsPromise]);
      setDrawerRequiredDocs(reqDocs.map((d) => d.doc_type_code));
      setDrawerPersonDocs((docsRes.data ?? []) as PersonDocument[]);
    };

    run();
  }, [openId]);

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
                      {a.docs.length > 0 ? (
                        <span className="text-sm">{valid}/{a.docs.length}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
                <div className="flex items-center justify-between">
                  <SheetTitle>{current.full_name}</SheetTitle>
                  {current.person_id && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/persons/$personId" params={{ personId: current.person_id }}>
                        <ExternalLink className="mr-1 h-3 w-3" /> Fiche personne
                      </Link>
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <AccredDrawerBody
                  accreditation={current}
                  completeness={completeness(current)}
                  docTypes={docTypes}
                  requiredDocCodes={drawerRequiredDocs}
                  personDocs={drawerPersonDocs}
                  personId={drawerPersonId}
                  gameId={gameId}
                  getDocStatusLabel={docStatusesHook.getLabel}
                  onReload={() => load()}
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
  accreditation, completeness, docTypes, requiredDocCodes, personDocs, personId, gameId,
  getDocStatusLabel,
  onReload, onDocStatus,
  onSubmit, onValidate, onReject,
}: {
  accreditation: Accreditation;
  completeness: number;
  docTypes: { code: string; label: string }[];
  requiredDocCodes: string[];
  personDocs: PersonDocument[];
  personId: string | null;
  gameId: string;
  getDocStatusLabel: (code: string | null | undefined) => string;
  onReload: () => void;
  onDocStatus: (doc: AccDoc, status: string) => void;
  onSubmit: () => void;
  onValidate: () => void;
  onReject: () => void;
}) {
  const a = accreditation;

  // Map of accreditation docs by doc_type (keep most recent if multiple)
  const accDocMap = new Map<string, AccDoc>();
  a.docs.forEach((d) => {
    const existing = accDocMap.get(d.doc_type);
    if (!existing || d.uploaded_at > existing.uploaded_at) {
      accDocMap.set(d.doc_type, d);
    }
  });

  // Group person docs by doc_type
  const personDocsByType = new Map<string, PersonDocument[]>();
  personDocs.forEach((d) => {
    if (!personDocsByType.has(d.doc_type)) personDocsByType.set(d.doc_type, []);
    personDocsByType.get(d.doc_type)!.push(d);
  });

  // All doc codes to display: required docs + any existing acc docs
  const allDocCodes = Array.from(new Set([
    ...requiredDocCodes,
    ...a.docs.map((d) => d.doc_type),
  ]));

  // Handle selecting a person document for an accreditation doc type
  const selectPersonDoc = async (docType: string, personDocId: string) => {
    const pd = personDocs.find((d) => d.id === personDocId);
    if (!pd) return;
    const existing = accDocMap.get(docType);
    const payload = {
      accreditation_id: a.id,
      doc_type: docType,
      file_name: pd.file_name,
      file_url: pd.file_url,
      status: pd.status === "valid" ? "valid" : "pending",
      uploaded_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from("accreditation_documents").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("accreditation_documents").insert(payload);
    }
    toast.success("Document lié à l'accréditation");
    onReload();
  };

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
          <div className="space-y-3">
            {allDocCodes.map((docType) => {
              const accDoc = accDocMap.get(docType);
              const candidates = personDocsByType.get(docType) ?? [];
              const label = docTypes.find((t) => t.code === docType)?.label ?? docType;
              const isRequired = requiredDocCodes.includes(docType);
              const docStatus = accDoc
                ? getDocStatusLabel(accDoc.status)
                : candidates.length > 0
                ? getDocStatusLabel(candidates[0].status)
                : "Manquant";
              const statusCls = accDoc
                ? clsForCode(accDoc.status)
                : candidates.length > 0
                ? clsForCode(candidates[0].status)
                : "bg-slate-200 text-foreground";

              return (
                <DocTypeRow
                  key={docType}
                  docType={docType}
                  label={label}
                  isRequired={isRequired}
                  accDoc={accDoc}
                  candidates={candidates}
                  docStatus={docStatus}
                  statusCls={statusCls}
                  personId={personId}
                  getDocStatusLabel={getDocStatusLabel}
                  onSelectPersonDoc={(pid) => selectPersonDoc(docType, pid)}
                  onDocStatus={(s) => accDoc && onDocStatus(accDoc, s)}
                  onUpload={async (url, fileName) => {
                    if (!personId) return;
                    // Lire la catégorie depuis app_type_items (groupe document_types)
                    const { data: atiRow } = await supabase
                      .from("app_type_items")
                      .select("category")
                      .eq("group_key", "document_types")
                      .eq("code", docType)
                      .maybeSingle();
                    const category = (atiRow as { category?: string } | null)?.category ?? "admin";
                    // Upload crée un person_document, puis le lie à l'accréditation
                    const { data: inserted } = await supabase.from("person_documents").insert({
                      person_id: personId,
                      doc_type: docType,
                      category,
                      file_name: fileName,
                      file_url: url,
                      status: "pending",
                    }).select("id").single();

                    const newDocId = (inserted as { id?: string } | null)?.id;
                    if (newDocId) {
                      await selectPersonDoc(docType, newDocId);
                    } else {
                      onReload();
                    }
                  }}
                />
              );
            })}
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// DocTypeRow — une ligne par type de document requis
// ─────────────────────────────────────────────────────────────────────────────

function DocTypeRow({
  docType, label, isRequired, accDoc, candidates, docStatus, statusCls, personId,
  getDocStatusLabel, onSelectPersonDoc, onDocStatus, onUpload,
}: {
  docType: string;
  label: string;
  isRequired: boolean;
  accDoc: AccDoc | undefined;
  candidates: PersonDocument[];
  docStatus: string;
  statusCls: string;
  personId: string | null;
  getDocStatusLabel: (code: string | null | undefined) => string;
  onSelectPersonDoc: (personDocId: string) => void;
  onDocStatus: (status: string) => void;
  onUpload: (url: string, fileName: string) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // The "selected" document is the accDoc if it exists, or the most recent person doc
  const selectedDoc: PersonDocument | undefined = accDoc
    ? { id: accDoc.id, doc_type: accDoc.doc_type, file_name: accDoc.file_name, file_url: accDoc.file_url, status: accDoc.status, person_id: "", category: null, issued_date: null, expiry_date: null, uploaded_by: null, requires_action: null, created_at: accDoc.uploaded_at }
    : candidates[0];

  const isImage = (url: string | null | undefined) =>
    !!url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm font-medium flex-1">
          {label}
          {isRequired && <span className="ml-1 text-xs text-red-600">*</span>}
        </p>
        <Badge className={`${statusCls} hover:${statusCls}`}>{docStatus}</Badge>
        {accDoc && accDoc.status !== "valid" && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDocStatus("valid")} aria-label="Valider">
            <Check className="h-4 w-4 text-emerald-600" />
          </Button>
        )}
        {accDoc && accDoc.status !== "rejected" && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDocStatus("rejected")} aria-label="Rejeter">
            <X className="h-4 w-4 text-red-600" />
          </Button>
        )}
      </div>

      {/* Selected document preview */}
      {selectedDoc && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
          {selectedDoc.file_url && isImage(selectedDoc.file_url) ? (
            <img src={selectedDoc.file_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedDoc.file_name}</p>
            <p className="text-xs text-muted-foreground">{getDocStatusLabel(selectedDoc.status)}</p>
          </div>
          {selectedDoc.file_url && (
            <a href={selectedDoc.file_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--lux-blue)] hover:underline">
              Voir
            </a>
          )}
        </div>
      )}

      {/* Dropdown to choose / add document */}
      {personId !== null && (
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full text-xs">
              {candidates.length > 0 || accDoc ? "Changer de document" : "Ajouter un document"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[350px]" align="start">
            <Command>
              <CommandList>
                <CommandEmpty>Aucun document trouvé.</CommandEmpty>

                {/* Existing person documents of this type */}
                {candidates.length > 0 && (
                  <CommandGroup heading="Documents de la personne">
                    {candidates.map((pd) => (
                      <CommandItem
                        key={pd.id}
                        value={`${pd.file_name} ${pd.id}`}
                        onSelect={() => { onSelectPersonDoc(pd.id); setDropdownOpen(false); }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {pd.file_url && isImage(pd.file_url) ? (
                            <img src={pd.file_url} alt="" className="h-8 w-8 rounded object-cover border border-border shrink-0" />
                          ) : (
                            <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{pd.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getDocStatusLabel(pd.status)}
                              {pd.issued_date && ` · ${new Date(pd.issued_date).toLocaleDateString("fr-FR")}`}
                            </p>
                          </div>
                          {pd.file_url && (
                            <a
                              href={pd.file_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-[var(--lux-blue)] hover:underline shrink-0"
                            >
                              Voir
                            </a>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Upload new document */}
                <CommandGroup>
                  <CommandItem
                    value="__upload_new__"
                    onSelect={() => { setShowUpload(true); setDropdownOpen(false); }}
                    className="font-medium text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Uploader un nouveau document
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Inline upload */}
      {showUpload && (
        <div className="pt-1">
          <FileUpload
            bucket="documents"
            path={`persons/${personId ?? ""}/${docType}/${Date.now()}_`}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onUploaded={(url, fileName) => { onUpload(url, fileName); setShowUpload(false); }}
          />
        </div>
      )}
    </div>
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