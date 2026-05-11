import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Archive, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type Game,
  GAME_STATUSES,
  GAME_TYPES,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/games/$id")({
  component: GameLayout,
});

const TABS = [
  { to: "/games/$id", label: "Vue d'ensemble", exact: true },
  { to: "/games/$id/selections", label: "Sélections" },
  { to: "/games/$id/delegation", label: "Délégation" },
  { to: "/games/$id/accreditations", label: "Accréditations" },
  { to: "/games/$id/logistics", label: "Logistique" },
] as const;

function GameLayout() {
  const { id } = Route.useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    setLoading(false);
    if (error) {
      toast.error("Erreur de chargement", { description: error.message });
      return;
    }
    setGame((data ?? null) as Game | null);
  };

  useEffect(() => { load(); }, [id]);

  const archive = async () => {
    if (!game) return;
    const { error } = await supabase.from("games").update({ status: "archived" }).eq("id", game.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Games archivé"); load(); }
  };

  const exportOfficial = async () => {
    if (!game) return;
    const { data, error } = await supabase
      .from("selections")
      .select("status, athlete:athletes(cosl_id, first_name, last_name, gender, birth_date), sport:sports(name), discipline:disciplines(name, gender)")
      .eq("game_id", game.id)
      .in("status", ["selected", "reserve"]);
    if (error) {
      toast.error("Export impossible", { description: error.message });
      return;
    }
    const rows = (data ?? []) as Array<{
      status: string;
      athlete: { cosl_id: string; first_name: string; last_name: string; gender: string; birth_date: string } | null;
      sport: { name: string } | null;
      discipline: { name: string; gender: string } | null;
    }>;
    const header = ["COSL ID", "Nom", "Prénom", "Genre", "Naissance", "Sport", "Discipline", "Statut sélection"];
    const csv = [header.join(",")]
      .concat(
        rows.map((r) =>
          [
            r.athlete?.cosl_id ?? "",
            r.athlete?.last_name ?? "",
            r.athlete?.first_name ?? "",
            r.athlete?.gender ?? "",
            r.athlete?.birth_date ?? "",
            r.sport?.name ?? "",
            r.discipline?.name ?? "",
            r.status,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      )
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liste_officielle_${(game.short_name ?? game.name).replace(/\W+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate({ to: "/games" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-slate-600">Games introuvable.</p>
      </div>
    );
  }

  const t = GAME_TYPES.find((x) => x.value === game.game_type);
  const s = GAME_STATUSES.find((x) => x.value === game.status);
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/games" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> Tous les Games
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {t && <Badge className={`${t.cls} hover:${t.cls}`}>{t.label}</Badge>}
              {s && <Badge className={`${s.cls} hover:${s.cls}`}>{s.label}</Badge>}
              <span className="text-sm text-slate-500">Édition {game.edition_year}</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">{game.name}</h1>
            <p className="text-sm text-slate-600">
              {fmt(game.competition_start)} → {fmt(game.competition_end)}
              {(game.host_city || game.host_country) && (
                <span> · {[game.host_city, game.host_country].filter(Boolean).join(", ")}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/games" })}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier
            </Button>
            <Button variant="outline" size="sm" onClick={archive}>
              <Archive className="mr-2 h-4 w-4" /> Archiver
            </Button>
            <Button size="sm" onClick={exportOfficial} className="bg-indigo-500 hover:bg-indigo-600">
              <Download className="mr-2 h-4 w-4" /> Exporter liste officielle
            </Button>
          </div>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => {
          const fullPath = t.to.replace("$id", id);
          const isActive = t.exact
            ? location.pathname === fullPath || location.pathname === fullPath + "/"
            : location.pathname.startsWith(fullPath);
          return (
            <Link
              key={t.to}
              to={t.to}
              params={{ id }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                isActive
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
