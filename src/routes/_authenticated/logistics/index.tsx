import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useState } from "react";
import { Plane, MapPin, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { type Game, GAME_STATUSES, GAME_TYPES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/logistics/")({
  component: LogisticsGlobal,
});

type Row = {
  game: Game;
  plansCount: number;
  travellers: number;
  alerts: number;
};

function LogisticsGlobal() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: games, error } = await supabase
        .from("games")
        .select("*")
        .in("status", ["preparation", "in_progress"])
        .order("competition_start", { ascending: true });
      if (error) {
        toast.error("Erreur de chargement", { description: friendlyError(error) });
        setLoading(false);
        return;
      }
      const list = (games ?? []) as Game[];

      const result: Row[] = [];
      for (const g of list) {
        const { data: plans } = await supabase
          .from("travel_plans")
          .select("id, status")
          .eq("game_id", g.id);
        const activePlans = (plans ?? []).filter(
          (p: { status: string }) => p.status !== "cancelled",
        );
        const planIds = activePlans.map((p: { id: string }) => p.id);

        let travellers = 0;
        if (planIds.length) {
          const { data: flights } = await supabase
            .from("flights")
            .select("id")
            .in("travel_plan_id", planIds);
          const flightIds = (flights ?? []).map((f: { id: string }) => f.id);
          if (flightIds.length) {
            const { count } = await supabase
              .from("flight_passengers")
              .select("id", { count: "exact", head: true })
              .in("flight_id", flightIds);
            travellers = count ?? 0;
          }
        }

        const { data: accs } = await supabase
          .from("accommodations")
          .select("id")
          .eq("game_id", g.id);
        const accIds = (accs ?? []).map((a: { id: string }) => a.id);
        let alerts = 0;
        if (accIds.length) {
          const { count: missingRooming } = await supabase
            .from("rooming_assignments")
            .select("id", { count: "exact", head: true })
            .in("accommodation_id", accIds)
            .is("room_number", null);
          alerts = missingRooming ?? 0;
        }

        result.push({
          game: g,
          plansCount: activePlans.length,
          travellers,
          alerts,
        });
      }
      setRows(result);
      setLoading(false);
    })();
  }, []);

  const totals = rows.reduce(
    (acc, r) => ({
      plans: acc.plans + r.plansCount,
      travellers: acc.travellers + r.travellers,
      alerts: acc.alerts + r.alerts,
    }),
    { plans: 0, travellers: 0, alerts: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Logistique</h1>
        <p className="text-sm text-muted-foreground">
          Vue transverse des Games actifs : voyages, hébergement, transport.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={<Plane className="h-5 w-5" />} label="Plans de voyage actifs" value={totals.plans} />
        <KpiCard icon={<MapPin className="h-5 w-5" />} label="Personnes en voyage" value={totals.travellers} />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Alertes"
          value={totals.alerts}
          tone={totals.alerts > 0 ? "warn" : "ok"}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="Aucun Games actif." />
      ) : (
        <div className="space-y-3">
          {rows.map(({ game, plansCount, travellers, alerts }) => {
            const t = GAME_TYPES.find((x) => x.value === game.game_type);
            const s = GAME_STATUSES.find((x) => x.value === game.status);
            return (
              <Link
                key={game.id}
                to="/games/$id/logistics"
                params={{ id: game.id }}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-5 hover:border-indigo-300 hover:shadow-sm transition"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t && <Badge className={`${t.cls} hover:${t.cls}`}>{t.label}</Badge>}
                    {s && <Badge className={`${s.cls} hover:${s.cls}`}>{s.label}</Badge>}
                    <span className="text-xs text-muted-foreground">Édition {game.edition_year}</span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{game.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {[game.host_city, game.host_country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <Stat label="Plans" value={plansCount} />
                  <Stat label="Voyageurs" value={travellers} />
                  <Stat label="Alertes" value={alerts} tone={alerts > 0 ? "warn" : undefined} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className={tone === "warn" ? "text-amber-600" : "text-indigo-500"}>{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-semibold ${tone === "warn" ? "text-amber-600" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
