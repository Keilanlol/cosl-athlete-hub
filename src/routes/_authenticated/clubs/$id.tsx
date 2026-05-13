import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Shield,
  Users,
  UserCog,
  Mail,
  Phone,
  MapPin,
  Trophy,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Athlete, Club, Coach, Federation, Sport } from "@/lib/types";
import { ATHLETE_STATUSES, COACH_ROLES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/clubs/$id")({
  component: ClubDetailPage,
});

type AthleteRow = Athlete & {
  primary_sport?: { name: string } | null;
};

function statusBadge(s: string) {
  const m = ATHLETE_STATUSES.find((x) => x.value === s);
  return <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`}>{m?.label ?? s}</Badge>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-sm text-slate-600">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ageOf(birth: string | null) {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(+d)) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

function ClubDetailPage() {
  const { id } = Route.useParams();
  const [club, setClub] = useState<Club | null>(null);
  const [fed, setFed] = useState<Federation | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const cl = await supabase.from("clubs").select("*").eq("id", id).maybeSingle();
      if (cl.error) toast.error("Erreur de chargement", { description: cl.error.message });
      const c = (cl.data ?? null) as Club | null;
      setClub(c);
      const [f, co, a, sp] = await Promise.all([
        c
          ? supabase.from("federations").select("*").eq("id", c.federation_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("coaches").select("*").eq("club_id", id).order("last_name"),
        supabase
          .from("athletes")
          .select("*, primary_sport:sports!athletes_primary_sport_id_fkey(name)")
          .eq("current_club_id", id)
          .order("last_name"),
        supabase.from("sports").select("*"),
      ]);
      setFed(((f as { data: Federation | null }).data ?? null) as Federation | null);
      setCoaches((co.data ?? []) as Coach[]);
      setAthletes((a.data ?? []) as AthleteRow[]);
      setSports((sp.data ?? []) as Sport[]);
      setLoading(false);
    })();
  }, [id]);

  const stats = useMemo(() => {
    const active = athletes.filter((a) => a.status === "active").length;
    const male = athletes.filter((a) => a.gender === "male").length;
    const female = athletes.filter((a) => a.gender === "female").length;
    const ages = athletes.map((a) => ageOf(a.birth_date)).filter((n): n is number => n != null);
    const avgAge = ages.length ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length) : null;
    const sportCounts = new Map<string, number>();
    athletes.forEach((a) => {
      const n = a.primary_sport?.name ?? "—";
      sportCounts.set(n, (sportCounts.get(n) ?? 0) + 1);
    });
    return {
      athletes: athletes.length,
      coaches: coaches.length,
      active,
      male,
      female,
      avgAge,
      sportCounts: Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [athletes, coaches]);

  if (loading) return <div className="p-6 text-slate-500">Chargement…</div>;
  if (!club) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clubs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Link>
        </Button>
        <EmptyState message="Club introuvable." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/clubs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Clubs
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Shield className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{club.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {fed && (
                <Link
                  to="/federations/$id"
                  params={{ id: fed.id }}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {fed.acronym} — {fed.name}
                </Link>
              )}
              {club.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {club.city}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={Users}
          label="Adhérents"
          value={stats.athletes}
          hint={`${stats.active} actif(s)`}
        />
        <StatCard icon={UserCog} label="Encadrement" value={stats.coaches} />
        <StatCard
          icon={Trophy}
          label="Sports"
          value={stats.sportCounts.length}
        />
        <StatCard
          icon={Users}
          label="Mixité"
          value={`${stats.male}H / ${stats.female}F`}
          hint={stats.avgAge ? `Âge moyen ${stats.avgAge} ans` : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Adresse</div>
              <div className="text-slate-900">
                {club.address ?? "—"}
                {club.city ? `, ${club.city}` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Fédération</div>
              <div className="text-slate-900">
                {fed ? `${fed.acronym} — ${fed.name}` : "—"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {club.email ? (
                <a href={`mailto:${club.email}`} className="text-indigo-600 hover:underline">
                  {club.email}
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{club.phone ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par sport</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.sportCounts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun adhérent enregistré.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.sportCounts.slice(0, 6).map(([name, n]) => (
                  <li key={name} className="flex items-center justify-between">
                    <span className="text-slate-700">{name}</span>
                    <Badge variant="outline">{n}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="athletes">
        <TabsList>
          <TabsTrigger value="athletes">Adhérents ({athletes.length})</TabsTrigger>
          <TabsTrigger value="coaches">Encadrement ({coaches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="athletes" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            {athletes.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun adhérent." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Âge</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>COSL ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athletes.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/athletes/$id"
                          params={{ id: a.id }}
                          className="text-indigo-600 hover:underline"
                        >
                          {a.first_name} {a.last_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {a.primary_sport?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {ageOf(a.birth_date) ?? "—"}
                      </TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {a.cosl_id || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coaches" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            {coaches.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun encadrant rattaché." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coaches.map((c) => {
                    const role = COACH_ROLES.find((r) => r.value === c.role)?.label ?? c.role;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.first_name} {c.last_name}
                        </TableCell>
                        <TableCell className="text-slate-600">{role}</TableCell>
                        <TableCell className="text-slate-600">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{c.phone ?? "—"}</TableCell>
                        <TableCell>
                          {c.is_active ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactif</Badge>
                          )}
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
    </div>
  );
}
