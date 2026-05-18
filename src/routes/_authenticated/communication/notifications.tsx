import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { type Notification } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton, EmptyState, PagerBar, PAGE_SIZE } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/communication/notifications")({
  component: NotificationsPage,
});

type AthleteRef = { id: string; first_name: string; last_name: string };
type GameRef = { id: string; name: string };

function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [athletes, setAthletes] = useState<Record<string, AthleteRef>>({});
  const [games, setGames] = useState<Record<string, GameRef>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erreur", { description: error.message }); setLoading(false); return; }
    const list = (data ?? []) as Notification[];
    setNotifs(list);

    const aIds = Array.from(new Set(list.map((n) => n.related_athlete_id).filter(Boolean) as string[]));
    const gIds = Array.from(new Set(list.map((n) => n.related_game_id).filter(Boolean) as string[]));
    const [{ data: aRows }, { data: gRows }] = await Promise.all([
      aIds.length
        ? supabase.from("athletes").select("id, first_name, last_name").in("id", aIds)
        : Promise.resolve({ data: [] as AthleteRef[] }),
      gIds.length
        ? supabase.from("games").select("id, name").in("id", gIds)
        : Promise.resolve({ data: [] as GameRef[] }),
    ]);
    const aMap: Record<string, AthleteRef> = {};
    (aRows ?? []).forEach((a) => { aMap[a.id] = a as AthleteRef; });
    const gMap: Record<string, GameRef> = {};
    (gRows ?? []).forEach((g) => { gMap[g.id] = g as GameRef; });
    setAthletes(aMap);
    setGames(gMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const types = useMemo(
    () => Array.from(new Set(notifs.map((n) => n.notification_type))),
    [notifs],
  );

  const filtered = useMemo(
    () =>
      notifs.filter((n) => {
        if (filterType !== "all" && n.notification_type !== filterType) return false;
        if (filterRead === "read" && !n.is_read) return false;
        if (filterRead === "unread" && n.is_read) return false;
        return true;
      }),
    [notifs, filterType, filterRead],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleRead = async (n: Notification, v: boolean) => {
    const { error } = await supabase.from("notifications").update({ is_read: v }).eq("id", n.id);
    if (error) return toast.error("Échec", { description: error.message });
    setNotifs((arr) => arr.map((x) => (x.id === n.id ? { ...x, is_read: v } : x)));
  };

  const markAllRead = async () => {
    const ids = filtered.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return toast.info("Tout est déjà lu");
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success(`${ids.length} notification(s) marquée(s) comme lue(s)`);
    load();
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Historique des alertes système.</p>
        </div>
        <Button variant="outline" onClick={markAllRead}>
          <CheckCheck className="mr-2 h-4 w-4" /> Tout marquer comme lu
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRead} onValueChange={setFilterRead}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="unread">Non lus</SelectItem>
            <SelectItem value="read">Lus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <TableSkeleton cols={5} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune notification." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Lié à</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Lu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((n) => {
                const a = n.related_athlete_id ? athletes[n.related_athlete_id] : null;
                const g = n.related_game_id ? games[n.related_game_id] : null;
                return (
                  <TableRow key={n.id} className={n.is_read ? "" : "bg-amber-50/40"}>
                    <TableCell>
                      <Badge variant="outline">{n.notification_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">{n.message}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {a && <div>👤 {a.first_name} {a.last_name}</div>}
                      {g && <div>🏟 {g.name}</div>}
                      {!a && !g && "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{fmt(n.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={!!n.is_read}
                        onCheckedChange={(v) => toggleRead(n, v)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={totalPages} onChange={setPage} />
    </div>
  );
}
