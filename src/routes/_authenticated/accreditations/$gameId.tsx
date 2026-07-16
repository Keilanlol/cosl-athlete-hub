import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";
import { useAccreditationRequirements } from "@/hooks/useAccreditationRequirements";
import { useAppTypes, type AppTypeItem } from "@/lib/app-types";
import { confirmAction } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/accreditations/$gameId")({
  component: AccreditationConfigPage,
});

const SELECTION_STAGES = [
  { value: "pre_selected", label: "Long List" },
  { value: "selected", label: "Short List" },
  { value: "reserve", label: "Réserve" },
] as const;

function AccreditationConfigPage() {
  const { gameId } = Route.useParams();
  const [game, setGame] = useState<{ name: string; short_name: string | null; edition_year: number } | null>(null);
  const { groups, loading: typesLoading } = useAppTypes();
  const { rows, loading: reqLoading, upsert, remove } = useAccreditationRequirements(gameId);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addDocCode, setAddDocCode] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("games")
      .select("name, short_name, edition_year")
      .eq("id", gameId)
      .maybeSingle();
    if (error) {
      toast.error("Erreur", { description: friendlyError(error) });
      return;
    }
    setGame((data ?? null) as { name: string; short_name: string | null; edition_year: number } | null);
  };

  useEffect(() => {
    load();
  }, [gameId]);

  // Get accreditation categories from app_type_items
  const roles = useMemo(() => {
    const group = groups.find((g) => g.key === "accreditation_categories");
    return group?.items ?? [];
  }, [groups]);

  // Get ALL document types from app_type_items
  const allDocTypes = useMemo(() => {
    const group = groups.find((g) => g.key === "document_types");
    return group?.items ?? [];
  }, [groups]);

  // Set default active role
  useEffect(() => {
    if (!activeRole && roles.length > 0) {
      setActiveRole(roles[0].code);
    }
  }, [roles, activeRole]);

  // Build a lookup: role_code → doc_type_code → selection_stage → required
  const reqMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string | "__null__", boolean>>> = {};
    rows.forEach((r) => {
      const stageKey = r.selection_stage ?? "__null__";
      if (!map[r.role_code]) map[r.role_code] = {};
      if (!map[r.role_code][r.doc_type_code]) map[r.role_code][r.doc_type_code] = {};
      map[r.role_code][r.doc_type_code][stageKey] = r.required;
    });
    return map;
  }, [rows]);

  // Doc types that have been added for the active role (appear in the matrix)
  const roleDocTypes = useMemo<AppTypeItem[]>(() => {
    if (!activeRole) return [];
    const addedCodes = Object.keys(reqMap[activeRole] ?? {});
    return allDocTypes.filter((dt) => addedCodes.includes(dt.code));
  }, [activeRole, reqMap, allDocTypes]);

  // Doc types that can still be added (not yet in the matrix for this role)
  const availableDocTypes = useMemo<AppTypeItem[]>(() => {
    if (!activeRole) return allDocTypes;
    const addedCodes = new Set(Object.keys(reqMap[activeRole] ?? {}));
    return allDocTypes.filter((dt) => !addedCodes.has(dt.code));
  }, [activeRole, reqMap, allDocTypes]);

  const isAthleteRole = activeRole === "athlete";

  const toggleReq = async (docTypeCode: string, selectionStage: string | null) => {
    const stageKey = selectionStage ?? "__null__";
    const currentVal = reqMap[activeRole ?? ""]?.[docTypeCode]?.[stageKey] ?? false;
    await upsert({
      game_id: gameId,
      role_code: activeRole ?? "",
      doc_type_code: docTypeCode,
      selection_stage: selectionStage,
      required: !currentVal,
    });
  };

  const checkReq = (docTypeCode: string, selectionStage: string | null): boolean => {
    const stageKey = selectionStage ?? "__null__";
    return reqMap[activeRole ?? ""]?.[docTypeCode]?.[stageKey] ?? false;
  };

  // Add a document type to the role's matrix (creates rows with required=false)
  const addDocType = async () => {
    if (!addDocCode || !activeRole) return;
    const stages = isAthleteRole
      ? SELECTION_STAGES.map((s) => s.value)
      : [null];
    for (const stage of stages) {
      await upsert({
        game_id: gameId,
        role_code: activeRole,
        doc_type_code: addDocCode,
        selection_stage: stage,
        required: false,
      });
    }
    toast.success("Type de document ajouté");
    setAddDocCode("");
    setAddDocOpen(false);
  };

  // Remove a document type from the role's matrix (delete all rows for this role+doc_type)
  const removeDocType = async (docTypeCode: string) => {
    if (!activeRole) return;
    const ok = await confirmAction({
      title: "Retirer ce type de document ?",
      description: "Toutes les exigences pour ce type et ce rôle seront supprimées.",
      confirmLabel: "Retirer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("accreditation_requirements")
      .delete()
      .eq("game_id", gameId)
      .eq("role_code", activeRole)
      .eq("doc_type_code", docTypeCode);
    if (error) {
      toast.error("Erreur", { description: friendlyError(error) });
      return;
    }
    toast.success("Type de document retiré");
  };

  if (typesLoading || reqLoading) {
    return <div className="p-6"><TableSkeleton cols={4} /></div>;
  }

  if (!game) {
    return <div className="p-6"><EmptyState message="Games introuvable." /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/accreditations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux accréditations
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/games/$id/accreditations" params={{ id: gameId }}>
            Accréditations en cours
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <BadgeCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {game.name} {game.edition_year}
          </h1>
          <p className="text-sm text-muted-foreground">
            Configuration des documents requis par rôle et étape de sélection
          </p>
        </div>
      </div>

      {/* Role selector */}
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.code}
            onClick={() => setActiveRole(r.code)}
            className="focus:outline-none"
          >
            <Badge
              className={`cursor-pointer text-sm ${
                activeRole === r.code
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {r.label}
            </Badge>
          </button>
        ))}
      </div>

      {/* Matrix */}
      {activeRole && (
        <>
          {roleDocTypes.length > 0 ? (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type de document</TableHead>
                    {isAthleteRole ? (
                      SELECTION_STAGES.map((s) => (
                        <TableHead key={s.value} className="text-center w-28">
                          {s.label}
                        </TableHead>
                      ))
                    ) : (
                      <TableHead className="text-center w-28">Requis</TableHead>
                    )}
                    <TableHead className="w-12 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleDocTypes.map((dt) => (
                    <TableRow key={dt.code}>
                      <TableCell className="font-medium">{dt.label}</TableCell>
                      {isAthleteRole ? (
                        SELECTION_STAGES.map((s) => (
                          <TableCell key={s.value}>
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={checkReq(dt.code, s.value)}
                                onCheckedChange={() => toggleReq(dt.code, s.value)}
                              />
                            </div>
                          </TableCell>
                        ))
                      ) : (
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={checkReq(dt.code, null)}
                              onCheckedChange={() => toggleReq(dt.code, null)}
                            />
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDocType(dt.code)}
                          aria-label="Retirer"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun type de document configuré pour ce rôle.
                <br />
                Cliquez sur « Ajouter un document » pour commencer.
              </p>
            </div>
          )}

          {/* Add document button */}
          <div className="flex justify-start">
            <Button
              variant="outline"
              onClick={() => { setAddDocCode(""); setAddDocOpen(true); }}
              disabled={availableDocTypes.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" /> Ajouter un document
            </Button>
            {availableDocTypes.length === 0 && (
              <span className="ml-3 self-center text-xs text-muted-foreground">
                Tous les types de documents sont déjà ajoutés.
              </span>
            )}
          </div>
        </>
      )}

      {/* Add document dialog */}
      <Dialog open={addDocOpen} onOpenChange={setAddDocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un type de document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Select value={addDocCode} onValueChange={setAddDocCode}>
              <SelectTrigger><SelectValue placeholder="Choisir un type…" /></SelectTrigger>
              <SelectContent>
                {availableDocTypes.map((dt) => (
                  <SelectItem key={dt.code} value={dt.code}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDocOpen(false)}>Annuler</Button>
            <Button
              className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              onClick={addDocType}
              disabled={!addDocCode}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}