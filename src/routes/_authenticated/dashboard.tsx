import React, { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Trophy,
  BadgeCheck,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { GAME_TYPES, type GameType, type GameStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type UpcomingGame = {
  id: string;
  name: string;
  short_name: string | null;
  game_type: GameType;
  status: GameStatus;
  host_country: string | null;
  host_city: string | null;
  competition_start: string;
};

type NotificationRow = {
  id: string;
  notification_type: string;
  message: string;
  is_read: boolean | null;
  created_at: string;
};

function DashboardPage() {
  const { full_name } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    athletes: 0,
    games: 0,
    accredsPending: 0,
    notifsUnread: 0,
  });
  const [kyc, setKyc] = useState({ green: 0, orange: 0, red: 0 });
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGame[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const in30 = new Date();
        in30.setDate(in30.getDate() + 30);
        const in30s = in30.toISOString().slice(0, 10);

        const [
          athletesRes,
          gamesActiveRes,
          accredsPendingRes,
          notifsUnreadRes,
          kycGreenRes,
          kycOrangeRes,
          kycRedRes,
          notifsListRes,
          upcomingRes,
          expiringRes,
        ] = await Promise.all([
          supabase.from("athletes").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("games").select("id", { count: "exact", head: true }).in("status", ["preparation", "in_progress"]),
          supabase.from("accreditations").select("id", { count: "exact", head: true }).eq("status", "submitted"),
          supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
          supabase.from("athlete_kyc").select("athlete_id", { count: "exact", head: true }).eq("global_status", "green"),
          supabase.from("athlete_kyc").select("athlete_id", { count: "exact", head: true }).eq("global_status", "orange"),
          supabase.from("athlete_kyc").select("athlete_id", { count: "exact", head: true }).eq("global_status", "red"),
          supabase
            .from("notifications")
            .select("id,notification_type,message,is_read,created_at")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("games")
            .select("id, name, short_name, game_type, competition_start, host_city, host_country, status")
            .in("status", ["preparation", "in_progress"])
            .gte("competition_start", today)
            .order("competition_start", { ascending: true })
            .limit(6),
          supabase
            .from("athlete_documents")
            .select("id", { count: "exact", head: true })
            .lte("expiry_date", in30s)
            .gte("expiry_date", today)
            .neq("status", "expired"),
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
        setNotifs((notifsListRes.data as NotificationRow[]) ?? []);
        setUpcomingGames((upcomingRes.data as UpcomingGame[]) ?? []);
        setExpiringDocs(expiringRes.count ?? 0);
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

  const firstName = full_name ? full_name.split(" ")[0] : null;
  const hasAlerts =
    kyc.red > 0 || expiringDocs > 0 || kpis.accredsPending > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Bonjour{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <img src="/logo-cosl.png" alt="COSL" className="h-10 w-auto opacity-60" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-6 w-6" />}
          label="Athlètes actifs"
          value={kpis.athletes}
          tone="default"
          to="/athletes"
          loading={loading}
        />
        <KpiCard
          icon={<Trophy className="h-6 w-6" />}
          label="Games en cours"
          value={kpis.games}
          tone="default"
          to="/games"
          loading={loading}
        />
        <KpiCard
          icon={<ShieldX className="h-6 w-6" />}
          label="KYC non conformes"
          value={kyc.red}
          sublabel="nécessitent une action"
          tone="red"
          to="/athletes"
          loading={loading}
        />
        <KpiCard
          icon={<BadgeCheck className="h-6 w-6" />}
          label="Accréditations en attente"
          value={kpis.accredsPending}
          sublabel="soumises, à traiter"
          tone="amber"
          to="/accreditations"
          loading={loading}
        />
      </div>

      {/* Alertes */}
      {hasAlerts && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Actions requises
          </h2>
          <div className="space-y-2">
            {kyc.red > 0 && (
              <AlertItem
                tone="red"
                icon={<ShieldX className="h-4 w-4" />}
                message={`${kyc.red} athlète${kyc.red > 1 ? "s" : ""} avec KYC non conforme${kyc.red > 1 ? "s" : ""}`}
                cta="Voir les athlètes"
                to="/athletes"
              />
            )}
            {expiringDocs > 0 && (
              <AlertItem
                tone="amber"
                icon={<AlertTriangle className="h-4 w-4" />}
                message={`${expiringDocs} document${expiringDocs > 1 ? "s" : ""} expirant dans les 30 prochains jours`}
                cta="Voir les athlètes"
                to="/athletes"
              />
            )}
            {kpis.accredsPending > 0 && (
              <AlertItem
                tone="amber"
                icon={<BadgeCheck className="h-4 w-4" />}
                message={`${kpis.accredsPending} accréditation${kpis.accredsPending > 1 ? "s" : ""} soumise${kpis.accredsPending > 1 ? "s" : ""} en attente de validation`}
                cta="Voir les accréditations"
                to="/accreditations"
              />
            )}
          </div>
        </section>
      )}

      {/* Prochains Games */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Prochains Games</h2>
          <Link
            to="/games"
            className="text-sm font-medium text-primary hover:text-[var(--cosl-red-dark)]"
          >
            Voir tous →
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-border bg-muted animate-pulse" />
            ))}
          </div>
        ) : upcomingGames.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun Games à venir.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {upcomingGames.map((g) => {
              const daysUntil = Math.ceil(
                (new Date(g.competition_start).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const t = GAME_TYPES.find((x) => x.value === g.game_type);
              return (
                <Link
                  key={g.id}
                  to="/games/$id"
                  params={{ id: g.id }}
                  className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[g.host_city, g.host_country].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    {t && (
                      <Badge className={`${t.cls} hover:${t.cls} shrink-0`}>
                        {t.label}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(g.competition_start).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <span
                      className={`text-sm font-bold ${
                        daysUntil <= 30
                          ? "text-primary"
                          : daysUntil <= 90
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      J{daysUntil > 0 ? `-${daysUntil}` : "+0"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* KYC + Notifications */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Conformité KYC</h2>
            <Link to="/athletes" className="text-xs text-primary hover:underline">
              Voir tout →
            </Link>
          </div>
          <div className="space-y-3">
            <KycRow icon={<ShieldCheck />} label="Conformes" value={kyc.green} tone="emerald" />
            <KycRow icon={<ShieldAlert />} label="Partiels" value={kyc.orange} tone="amber" />
            <KycRow icon={<ShieldX />} label="Non conformes" value={kyc.red} tone="red" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Notifications récentes</h2>
            <Link
              to="/communication/notifications"
              className="text-xs text-primary hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {notifs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification.</p>
          ) : (
            <ul className="divide-y">
              {notifs.slice(0, 4).map((n) => (
                <li key={n.id} className="flex items-start gap-2 py-2.5">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      n.is_read ? "bg-muted-foreground/40" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline" className="text-[10px] mb-0.5">
                      {n.notification_type}
                    </Badge>
                    <p className="text-xs text-foreground truncate">{n.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sublabel,
  tone = "default",
  to,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: "default" | "red" | "amber" | "emerald";
  to?: string;
  loading: boolean;
}) {
  const toneCls = {
    default: "bg-[var(--lux-blue-light)] text-[var(--lux-blue)]",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  }[tone];

  const content = (
    <div
      className={`rounded-xl border border-border bg-card p-5 flex items-center gap-4 ${to ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      <div className={`rounded-lg p-3 ${toneCls}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{label}</p>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
        ) : (
          <p className="text-3xl font-bold text-foreground mt-0.5">{value}</p>
        )}
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function AlertItem({
  tone,
  icon,
  message,
  cta,
  to,
}: {
  tone: "red" | "amber";
  icon: React.ReactNode;
  message: string;
  cta: string;
  to: string;
}) {
  const cls =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${cls}`}>
      {icon}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <Link
        to={to}
        className="text-xs font-semibold underline underline-offset-2 shrink-0"
      >
        {cta} →
      </Link>
    </div>
  );
}

function KycRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red";
}) {
  const cls = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
  }[tone];
  const textCls = cls.split(" ")[0];
  return (
    <div className="flex items-center gap-3">
      <div className={`rounded-md p-1.5 ${cls}`}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
          className: "h-4 w-4",
        })}
      </div>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      <span className={`text-lg font-bold ${textCls}`}>{value}</span>
    </div>
  );
}
