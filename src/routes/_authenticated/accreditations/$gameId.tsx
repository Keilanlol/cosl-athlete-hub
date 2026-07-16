import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";
import { useAccreditationRequirements } from "@/hooks/useAccreditationRequirements";
import { useAppTypes } from "@/lib/app-types";

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
  const navigate = useNavigate();
  const [game, setGame] = useState<{ name: string; short_name: string | null; edition_year: number } | null>(null);
  const { groups, loading: typesLoading } = useAppTypes();
  const { rows, loading: reqLoading, upsert } = useAccreditationRequirements(gameId);
  const [activeRole, setActiveRole] = useState<string | null>(null);

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

  // Get document types from app_type_items
  const docTypes = useMemo(() => {
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
      {activeRole && docTypes.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type de document</TableHead>
                {isAthleteRole ? (
                  SELECTION_STAGES.map((s) => (
                    <TableHead key={s.value} className="text-center">
                      {s.label}
                    </TableHead>
                  ))
                ) : (
                  <TableHead className="text-center">Requis</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {docTypes.map((dt) => (
                <TableRow key={dt.code}>
                  <TableCell className="font-medium">{dt.label}</TableCell>
                  {isAthleteRole ? (
                    SELECTION_STAGES.map((s) => (
                      <TableCell key={s.value} className="text-center">
                        <Checkbox
                          checked={checkReq(dt.code, s.value)}
                          onCheckedChange={() => toggleReq(dt.code, s.value)}
                        />
                      </TableCell>
                    ))
                  ) : (
                    <TableCell className="text-center">
                      <Checkbox
                        checked={checkReq(dt.code, null)}
                        onCheckedChange={() => toggleReq(dt.code, null)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {docTypes.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <EmptyState message="Aucun type de document configuré. Ajoutez-en depuis la page Types & Rôles." />
        </div>
      )}
    </div>
  );
}