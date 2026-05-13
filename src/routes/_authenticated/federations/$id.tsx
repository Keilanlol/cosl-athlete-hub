import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Users, Shield, UserCog, Mail, Phone, Globe, Trophy } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/federations/$id")({
  component: FederationDetailPage,
});

type AthleteRow = Athlete & {
  primary_sport?: { name: string } | null;
  current_club?: { id: string; name: string } | null;
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

function FederationDetailPage() {
  const { id } = Route.useParams();
  const [fed, setFed] = useState<Federation | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [f, c, co, a, sp] = await Promise.all([
        supabase.from("federations").select("*").eq("id", id).maybeSingle(),
        supabase.from("clubs").select("*").eq("federation_id", id).order("name"),
        supabase.from("coaches").select("*").eq("federation_id", id).order("last_name"),
        supabase
          .from("athletes")
          .select(
            "*, primary_sport:sports!athletes_primary_sport_id_fkey(name), current_club:clubs!athletes_current_club_id_fkey(id,name)",
          )
          .eq("primary_federation_id", id)
          .order("last_name"),
        supabase.from("sports").select("*"),
      ]);
      if (f.error) toast.error("Erreur de chargement", { description: f.error.message });
      setFed((f.data ?? null) as Federation | null);
      setClubs((c.data ?? []) as Club[]);
      setCoaches((co.data ?? []) as Coach[]);
      setAthletes((a.data ?? []) as AthleteRow[]);
      setSports((sp.data ?? []) as Sport[]);
      setLoading(false);
    })();
  }, [id]);

  const stats = useMemo(() => {
    const active = athletes.filter((a) => a.status === "active").length;
    const sportCounts = new Map<string, number>();
    athletes.forEach((a) => {
      const n = a.primary_sport?.name ?? "—";
      sportCounts.set(n, (sportCounts.get(n) ?? 0) + 1);
    });
    return {
      clubs: clubs.length,
      coaches: coaches.length,
      athletes: athletes.length,
      active,
      sportCounts: Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [clubs, coaches, athletes]);

  if (loading) {
    return <div className="p-6 text-slate-500">Chargement…</div>;
  }
  if (!fed) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/federations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Link>
        </Button>
        <EmptyState message="Fédération introuvable." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/federations">
              <ArrowLeft className="mr-2 h-4 w-4" /> Fédérations
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500 text-white">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                <span className="font-mono text-indigo-600">{fed.acronym}</span>{" "}
                <span className="text-slate-900">— {fed.name}</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {fed.is_olympic && (
                  <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                    Olympique
                  </Badge>
                )}
                {fed.international_federation && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> {fed.international_federation}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Shield} label="Clubs" value={stats.clubs} />
        <StatCard
          icon={Users}
          label="Athlètes"
          value={stats.athletes}
          hint={`${stats.active} actif(s)`}
        />
        <StatCard icon={UserCog} label="Encadrement" value={stats.coaches} />
        <StatCard
          icon={Trophy}
          label="Sports représentés"
          value={stats.sportCounts.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Président</div>
              <div className="text-slate-900">{fed.president_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Fédération internationale
              </div>
              <div className="text-slate-900">{fed.international_federation ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {fed.contact_email ? (
                <a href={`mailto:${fed.contact_email}`} className="text-indigo-600 hover:underline">
                  {fed.contact_email}
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{fed.contact_phone ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sports</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.sportCounts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun athlète enregistré.</p>
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

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubs ({clubs.length})</TabsTrigger>
          <TabsTrigger value="athletes">Athlètes ({athletes.length})</TabsTrigger>
          <TabsTrigger value="coaches">Encadrement ({coaches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clubs" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            {clubs.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun club affilié." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Athlètes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clubs.map((c) => {
                    const n = athletes.filter((a) => a.current_club?.id === c.id).length;
                    return (
                      <TableRow key={c.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link
                            to="/clubs/$id"
                            params={{ id: c.id }}
                            className="text-indigo-600 hover:underline"
                          >
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-600">{c.city ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{n}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="athletes" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            {athletes.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun athlète rattaché." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Club</TableHead>
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
                        {a.current_club?.name ?? "—"}
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
