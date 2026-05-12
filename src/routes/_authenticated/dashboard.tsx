import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Trophy,
  BadgeCheck,
  Bell,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Plane,
  Hotel,
  Inbox,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GAME_TYPES, type GameType, type GameStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type GameRow = {
  id: string;
  name: string;
  game_type: GameType;
  status: GameStatus;
  host_country: string | null;
  host_city: string | null;
  competition_start: string;
  competition_end: string;
};

type GameStats = {
  game: GameRow;
  selectionsCount: number;
  quotaTotal: number;
  accreditTotal: number;
  accreditValidated: number;
  travelPlans: number;
  flights: number;
  passengers: number;
  accommodations: number;
};

type AccredStatus =
  | "draft"
  | "submitted"
  | "validated"
  | "rejected"
  | "produced"
  | "delivered";

const ACCRED_LABELS: Record<AccredStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumise",
  validated: "Validée",
  rejected: "Rejetée",
  produced: "Produite",
  delivered: "Délivrée",
};
const ACCRED_COLORS: Record<AccredStatus, string> = {
  draft: "#94a3b8",
  submitted: "#f59e0b",
  validated: "#10b981",
  rejected: "#ef4444",
  produced: "#6366f1",
  delivered: "#0ea5e9",
};

type NotificationRow = {
  id: string;
  notification_type: string;
  message: string;
  is_read: boolean | null;
  created_at: string;
};

function gameTypeBadge(t: GameType) {
  return GAME_TYPES.find((g) => g.value === t) ?? GAME_TYPES[GAME_TYPES.length - 1];
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    athletes: 0,
    games: 0,
    accredsPending: 0,
    notifsUnread: 0,
  });
  const [gameStats, setGameStats] = useState<GameStats[]>([]);
  const [kyc, setKyc] = useState({ green: 0, orange: 0, red: 0 });
  const [accredsByStatus, setAccredsByStatus] = useState<Record<AccredStatus, number>>({
    draft: 0,
    submitted: 0,
    validated: 0,
    rejected: 0,
    produced: 0,
    delivered: 0,
  });
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const safeCount = async (
          q: ReturnType<typeof supabase.from>,
        ): Promise<number> => {
          // q already configured
          // @ts-expect-error generic chain
          const { count, error } = await q;
          if (error) {
            console.error(error);
            return 0;
          }
          return count ?? 0;
        };

        const [
          athletesRes,
          gamesActiveRes,
          accredsPendingRes,
          notifsUnreadRes,
          activeGamesListRes,
          kycGreenRes,
          kycOrangeRes,
          kycRedRes,
          allAccredsRes,
          notifsListRes,
        ] = await Promise.all([
          supabase.from("athletes").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase
            .from("games")
            .select("id", { count: "exact", head: true })
            .in("status", ["preparation", "in_progress"]),
          supabase
            .from("accreditations")
            .select("id", { count: "exact", head: true })
            .eq("status", "submitted"),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false),
          supabase
            .from("games")
            .select(
              "id,name,game_type,status,host_country,host_city,competition_start,competition_end",
            )
            .in("status", ["preparation", "in_progress"])
            .order("competition_start", { ascending: true }),
          supabase.from("athlete_kyc").select("athlete_id", { count: "exact", head: true }).eq("global_status", "green"),
          supabase.from("athlete_kyc").select("athlete_id", { count: "exact", head: true }).eq("global_status", "orange"),
          supabase.from("athlete_kyc").select("athlete_id", { count: "exact", head: true }).eq("global_status", "red"),
          supabase.from("accreditations").select("status"),
          supabase
            .from("notifications")
            .select("id,notification_type,message,is_read,created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;

        setKpis({
          athletes: athletesRes.count ?? 0,
          games: gamesActiveRes.count ?? 0,
          accredsPending: accredsPendingRes.count ?? 0,
          notifsUnread: notifsUnreadRes.count ?? 0,
        });

        setKyc({
          green: kycGreenRes.count ?? 0,
          orange: kycOrangeRes.count ?? 0,
          red: kycRedRes.count ?? 0,
        });

        // accreds by status
        const byStatus: Record<AccredStatus, number> = {
          draft: 0,
          submitted: 0,
          validated: 0,
          rejected: 0,
          produced: 0,
          delivered: 0,
        };
        if (allAccredsRes.error) {
          console.error(allAccredsRes.error);
        } else {
          for (const r of allAccredsRes.data ?? []) {
            const s = (r as { status: AccredStatus }).status;
            if (s in byStatus) byStatus[s]++;
          }
        }
        setAccredsByStatus(byStatus);

        setNotifs((notifsListRes.data as NotificationRow[]) ?? []);

        // Per-game stats
        const games = (activeGamesListRes.data as GameRow[]) ?? [];
        const perGame = await Promise.all(
          games.map(async (g) => {
            const [
              selCountR,
              quotasR,
              accTotalR,
              accValidR,
              travelPlansR,
              flightsR,
              accomR,
            ] = await Promise.all([
              supabase
                .from("selections")
                .select("id", { count: "exact", head: true })
                .eq("game_id", g.id)
                .in("status", ["selected", "reserve"]),
              supabase.from("game_quotas").select("quota_max").eq("game_id", g.id),
              supabase
                .from("accreditations")
                .select("id", { count: "exact", head: true })
                .eq("game_id", g.id),
              supabase
                .from("accreditations")
                .select("id", { count: "exact", head: true })
                .eq("game_id", g.id)
                .eq("status", "validated"),
              supabase
                .from("travel_plans")
                .select("id")
                .eq("game_id", g.id)
                .neq("status", "cancelled"),
              supabase
                .from("flights")
                .select("id, travel_plan:travel_plans!inner(game_id)")
                .eq("travel_plan.game_id", g.id),
              supabase
                .from("accommodations")
                .select("id", { count: "exact", head: true })
                .eq("game_id", g.id),
            ]);

            const quotaTotal = (quotasR.data ?? []).reduce(
              (s: number, r: { quota_max: number }) => s + (r.quota_max ?? 0),
              0,
            );

            // Passengers count via flight ids
            const flightIds = ((flightsR.data ?? []) as { id: string }[]).map((f) => f.id);
            let passengers = 0;
            if (flightIds.length) {
              const { count } = await supabase
                .from("flight_passengers")
                .select("id", { count: "exact", head: true })
                .in("flight_id", flightIds);
              passengers = count ?? 0;
            }

            return {
              game: g,
              selectionsCount: selCountR.count ?? 0,
              quotaTotal,
              accreditTotal: accTotalR.count ?? 0,
              accreditValidated: accValidR.count ?? 0,
              travelPlans: (travelPlansR.data ?? []).length,
              flights: flightIds.length,
              passengers,
              accommodations: accomR.count ?? 0,
            } as GameStats;
          }),
        );

        if (!cancelled) setGameStats(perGame);
      } catch (e) {
        console.error(e);
        toast.error("Erreur lors du chargement du dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const accredTotal = Object.values(accredsByStatus).reduce((a, b) => a + b, 0);
  const accredChartData = (Object.keys(ACCRED_LABELS) as AccredStatus[]).map((s) => ({
    name: ACCRED_LABELS[s],
    value: accredsByStatus[s],
    color: ACCRED_COLORS[s],
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vue d'ensemble — athlètes, Games, accréditations, logistique.
        </p>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          label="Athlètes actifs"
          value={kpis.athletes}
          loading={loading}
        />
        <KpiCard
          icon={<Trophy className="h-5 w-5 text-indigo-500" />}
          label="Games en cours / préparation"
          value={kpis.games}
          loading={loading}
        />
        <KpiCard
          icon={<BadgeCheck className="h-5 w-5 text-indigo-500" />}
          label="Accréditations en attente"
          value={kpis.accredsPending}
          loading={loading}
        />
        <KpiCard
          icon={<Bell className="h-5 w-5 text-indigo-500" />}
          label="Notifications non lues"
          value={kpis.notifsUnread}
          loading={loading}
        />
      </div>

      {/* Games actifs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Games actifs</h2>
          <Link to="/games" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Voir tous les Games →
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : gameStats.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8 text-slate-400" />}
            title="Aucun Games actif"
            cta={{ label: "Aller aux Games", to: "/games" }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {gameStats.map((gs) => {
              const t = gameTypeBadge(gs.game.game_type);
              const selPct = pct(gs.selectionsCount, gs.quotaTotal);
              const accPct = pct(gs.accreditValidated, gs.accreditTotal);
              return (
                <div
                  key={gs.game.id}
                  className="rounded-lg border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{gs.game.name}</h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {gs.game.host_city ?? "—"}
                        {gs.game.host_country ? `, ${gs.game.host_country}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {gs.game.competition_start} → {gs.game.competition_end}
                      </p>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${t.cls}`}>
                      {t.label}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <ProgressLine
                      label="Sélections"
                      value={gs.selectionsCount}
                      total={gs.quotaTotal}
                      pct={selPct}
                    />
                    <ProgressLine
                      label="Accréditations validées"
                      value={gs.accreditValidated}
                      total={gs.accreditTotal}
                      pct={accPct}
                    />
                  </div>

                  <Link
                    to="/games/$id"
                    params={{ id: gs.game.id }}
                    className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Voir le Games →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* KYC */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Conformité KYC</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KycCard
            icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
            label="Conformes"
            value={kyc.green}
            tone="emerald"
            loading={loading}
          />
          <KycCard
            icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}
            label="Partiels"
            value={kyc.orange}
            tone="amber"
            loading={loading}
          />
          <KycCard
            icon={<ShieldX className="h-5 w-5 text-red-600" />}
            label="Non conformes"
            value={kyc.red}
            tone="red"
            loading={loading}
          />
        </div>
        <Link
          to="/athletes"
          className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Voir les athlètes non conformes →
        </Link>
      </section>

      {/* Accreditations */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Accréditations — répartition</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2">Statut</th>
                    <th className="py-2 text-right">Nombre</th>
                    <th className="py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(ACCRED_LABELS) as AccredStatus[]).map((s) => (
                    <tr key={s} className="border-b last:border-0">
                      <td className="py-2 text-slate-700">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: ACCRED_COLORS[s] }}
                        />
                        {ACCRED_LABELS[s]}
                      </td>
                      <td className="py-2 text-right text-slate-900">{accredsByStatus[s]}</td>
                      <td className="py-2 text-right text-slate-500">
                        {accredTotal ? Math.round((accredsByStatus[s] / accredTotal) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={accredChartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <ReTooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {accredChartData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Logistics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Logistique — Games actifs</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <div className="p-5">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : gameStats.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">Aucun Games actif.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Games</th>
                  <th className="px-4 py-2 text-right">Plans voyage</th>
                  <th className="px-4 py-2 text-right">Vols</th>
                  <th className="px-4 py-2 text-right">Personnes</th>
                  <th className="px-4 py-2 text-right">Hébergements</th>
                </tr>
              </thead>
              <tbody>
                {gameStats.map((gs) => (
                  <tr key={gs.game.id} className="border-t">
                    <td className="px-4 py-2 text-slate-700">{gs.game.name}</td>
                    <td className="px-4 py-2 text-right text-slate-900">{gs.travelPlans}</td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      <span className="inline-flex items-center gap-1">
                        <Plane className="h-3.5 w-3.5 text-slate-400" />
                        {gs.flights}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">{gs.passengers}</td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      <span className="inline-flex items-center gap-1">
                        <Hotel className="h-3.5 w-3.5 text-slate-400" />
                        {gs.accommodations}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Dernières notifications</h2>
          <Link
            to="/communication/notifications"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Voir tout →
          </Link>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <div className="p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
              <Inbox className="h-4 w-4" /> Aucune notification.
            </div>
          ) : (
            <ul className="divide-y">
              {notifs.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                      n.is_read ? "bg-slate-300" : "bg-indigo-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {n.notification_type}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-700">
                      {n.message.length > 80 ? `${n.message.slice(0, 80)}…` : n.message}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {icon}
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-semibold text-slate-900">{value}</div>
        )}
      </div>
    </div>
  );
}

function KycCard({
  icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red";
  loading: boolean;
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-red-200 bg-red-50";
  return (
    <div className={`rounded-lg border p-5 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {icon}
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-semibold text-slate-900">{value}</div>
        )}
      </div>
    </div>
  );
}

function ProgressLine({
  label,
  value,
  total,
  pct,
}: {
  label: string;
  value: number;
  total: number;
  pct: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">
          {value} / {total} ({pct}%)
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        {icon}
      </div>
      <p className="mt-3 text-sm text-slate-600">{title}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
