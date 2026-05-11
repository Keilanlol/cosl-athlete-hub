import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, BellRing, MailOpen, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { type MessageSent } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/DataTableShell";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/communication/")({
  component: CommunicationDashboard,
});

function CommunicationDashboard() {
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState<MessageSent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [{ count: c1, error: e1 }, { count: c2 }, { data: rows, error: e3 }] =
        await Promise.all([
          supabase
            .from("messages_sent")
            .select("id", { count: "exact", head: true })
            .gte("sent_at", monthStart.toISOString()),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false),
          supabase
            .from("messages_sent")
            .select("*")
            .order("sent_at", { ascending: false })
            .limit(10),
        ]);
      if (e1 || e3) toast.error("Erreur de chargement");
      setSentThisMonth(c1 ?? 0);
      setUnread(c2 ?? 0);
      setLatest((rows ?? []) as MessageSent[]);
      setLoading(false);
    })();
  }, []);

  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Communication</h1>
        <p className="text-sm text-slate-500">Tableau de bord des envois et notifications.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card icon={<Mail className="h-5 w-5" />} label="Messages envoyés ce mois" value={sentThisMonth} />
        <Card icon={<MailOpen className="h-5 w-5" />} label="Taux d'ouverture moyen" value="62%" hint="Données indicatives" />
        <Card
          icon={<BellRing className="h-5 w-5" />}
          label="Notifications non lues"
          value={unread}
          tone={unread > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Derniers envois</h2>
        <div className="rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : latest.length === 0 ? (
            <div className="p-6">
              <EmptyState
                message="Aucun envoi pour le moment."
                action={
                  <Link
                    to="/communication/messages"
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Créer un premier envoi
                  </Link>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Destinataires</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latest.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.subject}</TableCell>
                    <TableCell>{m.recipients_count}</TableCell>
                    <TableCell className="text-xs text-slate-500">{m.audience_segment}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.channel}</Badge>
                    </TableCell>
                    <TableCell>{fmt(m.sent_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/communication/messages"
                        className="inline-flex items-center text-sm text-indigo-600 hover:underline"
                      >
                        <Eye className="mr-1 h-4 w-4" /> Voir
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "ok" | "warn";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 text-slate-500">
        <span className={tone === "warn" ? "text-amber-600" : "text-indigo-500"}>{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
