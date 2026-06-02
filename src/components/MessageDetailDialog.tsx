import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Recipient = { id: string; first_name: string; last_name: string };
type Sender = { full_name: string; email: string } | null;

type Props = {
  messageId: string | null;
  onClose: () => void;
};

export function MessageDetailDialog({ messageId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{
    subject: string;
    body: string;
    channel: string;
    audience_segment: string;
    sent_at: string;
    recipients_count: number;
    sent_by: string | null;
  } | null>(null);
  const [sender, setSender] = useState<Sender>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);

  useEffect(() => {
    if (!messageId) return;
    setLoading(true);
    setMsg(null);
    setSender(null);
    setRecipients(null);
    (async () => {
      const { data: m } = await supabase
        .from("messages_sent")
        .select("subject,body,channel,audience_segment,sent_at,recipients_count,sent_by")
        .eq("id", messageId)
        .maybeSingle();
      setMsg((m ?? null) as typeof msg);
      if (m?.sent_by) {
        const { data: u } = await supabase
          .from("user_profiles")
          .select("full_name,email")
          .eq("id", m.sent_by)
          .maybeSingle();
        setSender((u ?? null) as Sender);
      }
      const { data: rec } = await supabase
        .from("message_recipients")
        .select("athlete:athletes(id,first_name,last_name)")
        .eq("message_id", messageId);
      const list = ((rec ?? []) as unknown as Array<{ athlete: Recipient | Recipient[] | null }>)
        .map((r) => (Array.isArray(r.athlete) ? r.athlete[0] : r.athlete))
        .filter((x): x is Recipient => !!x)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));
      setRecipients(list);
      setLoading(false);
    })();
  }, [messageId]);

  return (
    <Dialog open={!!messageId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{msg?.subject ?? "Message"}</DialogTitle>
        </DialogHeader>
        {loading || !msg ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{msg.channel}</Badge>
              <span>•</span>
              <span>
                Envoyé par{" "}
                <span className="font-medium text-foreground">
                  {sender?.full_name ?? "—"}
                </span>
              </span>
              <span>•</span>
              <span>
                {new Date(msg.sent_at).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              <span>•</span>
              <span>{msg.audience_segment}</span>
            </div>

            <div className="rounded-md border border-border bg-muted p-3 whitespace-pre-wrap text-sm text-foreground">
              {msg.body}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                Destinataires ({recipients?.length ?? msg.recipients_count})
              </h4>
              {recipients === null ? (
                <Skeleton className="h-16 w-full" />
              ) : recipients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Liste détaillée non disponible pour ce message.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <ul className="divide-y divide-slate-100 text-sm">
                    {recipients.map((a) => (
                      <li key={a.id}>
                        <Link
                          to="/athletes/$id"
                          params={{ id: a.id }}
                          onClick={onClose}
                          className="block px-3 py-2 hover:bg-[var(--lux-blue-light)]"
                        >
                          {a.last_name.toUpperCase()}{" "}
                          <span className="text-foreground">{a.first_name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
