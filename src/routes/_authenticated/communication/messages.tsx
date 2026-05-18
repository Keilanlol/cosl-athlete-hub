import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Send, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type MessageTemplate,
  type Federation,
  type Game,
} from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/communication/messages")({
  component: MessagesPage,
});

type Audience =
  | { kind: "all_athletes" }
  | { kind: "delegation"; gameId: string }
  | { kind: "federation"; federationId: string }
  | { kind: "staff" };

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

type TemplateForm = { name: string; subject: string; body: string; channel: string; is_active: boolean };
const emptyTpl: TemplateForm = { name: "", subject: "", body: "", channel: "email", is_active: true };

function MessagesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [feds, setFeds] = useState<Federation[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Template dialog
  const [tplOpen, setTplOpen] = useState(false);
  const [tplEdit, setTplEdit] = useState<MessageTemplate | null>(null);
  const [tplForm, setTplForm] = useState<TemplateForm>(emptyTpl);
  const [tplDel, setTplDel] = useState<MessageTemplate | null>(null);
  const [tplSearch, setTplSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q),
    );
  }, [templates, tplSearch]);

  // Send block
  const [selectedTplId, setSelectedTplId] = useState<string>("none");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("email");
  const [audKind, setAudKind] = useState<Audience["kind"]>("all_athletes");
  const [audGameId, setAudGameId] = useState("");
  const [audFedId, setAudFedId] = useState("");
  const [recipients, setRecipients] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t, error }, { data: f }, { data: g }] = await Promise.all([
      supabase.from("message_templates").select("*").order("name"),
      supabase.from("federations").select("*").order("name"),
      supabase.from("games").select("*").order("competition_start", { ascending: false }),
    ]);
    setLoading(false);
    if (error) return toast.error("Erreur de chargement", { description: error.message });
    setTemplates((t ?? []) as MessageTemplate[]);
    setFeds((f ?? []) as Federation[]);
    setGames((g ?? []) as Game[]);
  };

  useEffect(() => { load(); }, []);

  // When template selected, prefill subject/body/channel
  useEffect(() => {
    if (selectedTplId === "none") return;
    const t = templates.find((x) => x.id === selectedTplId);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
      setChannel(t.channel);
    }
  }, [selectedTplId, templates]);

  // ----- Templates CRUD -----
  const openCreateTpl = () => { setTplEdit(null); setTplForm(emptyTpl); setTplOpen(true); };
  const openEditTpl = (t: MessageTemplate) => {
    setTplEdit(t);
    setTplForm({
      name: t.name, subject: t.subject, body: t.body, channel: t.channel, is_active: !!t.is_active,
    });
    setTplOpen(true);
  };
  const submitTpl = async () => {
    if (!tplForm.name.trim() || !tplForm.subject.trim() || !tplForm.body.trim())
      return toast.error("Nom, sujet et corps requis");
    const payload = {
      name: tplForm.name.trim(),
      subject: tplForm.subject.trim(),
      body: tplForm.body,
      channel: tplForm.channel,
      is_active: tplForm.is_active,
    };
    const { error } = tplEdit
      ? await supabase.from("message_templates").update(payload).eq("id", tplEdit.id)
      : await supabase.from("message_templates").insert(payload);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success(tplEdit ? "Template mis à jour" : "Template créé");
    setTplOpen(false);
    load();
  };
  const removeTpl = async () => {
    if (!tplDel) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", tplDel.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Template supprimé"); load(); }
    setTplDel(null);
  };

  const audience: Audience = useMemo(() => {
    if (audKind === "delegation") return { kind: "delegation", gameId: audGameId };
    if (audKind === "federation") return { kind: "federation", federationId: audFedId };
    if (audKind === "staff") return { kind: "staff" };
    return { kind: "all_athletes" };
  }, [audKind, audGameId, audFedId]);

  const audienceLabel = (a: Audience) => {
    switch (a.kind) {
      case "all_athletes": return "Tous les athlètes";
      case "delegation": return `Délégation Games · ${games.find((g) => g.id === a.gameId)?.name ?? "—"}`;
      case "federation": return `Athlètes fédération · ${feds.find((f) => f.id === a.federationId)?.name ?? "—"}`;
      case "staff": return "Encadrement";
    }
  };

  const computeRecipientIds = async (): Promise<string[]> => {
    if (audience.kind === "all_athletes") {
      const { data } = await supabase
        .from("athletes")
        .select("id")
        .eq("is_active", true);
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    }
    if (audience.kind === "federation" && audience.federationId) {
      const { data } = await supabase
        .from("athletes")
        .select("id")
        .eq("primary_federation_id", audience.federationId)
        .eq("is_active", true);
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    }
    if (audience.kind === "delegation" && audience.gameId) {
      const { data } = await supabase
        .from("selections")
        .select("athlete_id")
        .eq("game_id", audience.gameId)
        .in("status", ["selected", "reserve"]);
      return Array.from(new Set(((data ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id)));
    }
    return [];
  };

  const startSend = async () => {
    if (!subject.trim() || !body.trim()) return toast.error("Sujet et corps requis");
    if (audience.kind === "delegation" && !audience.gameId) return toast.error("Games requis");
    if (audience.kind === "federation" && !audience.federationId) return toast.error("Fédération requise");
    if (audience.kind === "staff") {
      const { count } = await supabase
        .from("coaches")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      setRecipients(count ?? 0);
    } else {
      const ids = await computeRecipientIds();
      setRecipients(ids.length);
    }
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    if (recipients == null) return;
    setSending(true);
    const payload = {
      template_id: selectedTplId !== "none" ? selectedTplId : null,
      game_id: audience.kind === "delegation" ? audience.gameId : null,
      channel,
      subject: subject.trim(),
      body,
      audience_segment: audienceLabel(audience),
      recipients_count: recipients,
      sent_by: user?.id ?? null,
    };
    const { data: inserted, error } = await supabase
      .from("messages_sent")
      .insert(payload)
      .select()
      .single();
    if (error || !inserted) {
      setSending(false);
      return toast.error("Échec", { description: error?.message });
    }
    // Track per-athlete recipients (skip "staff")
    if (audience.kind !== "staff") {
      const ids = await computeRecipientIds();
      if (ids.length) {
        const { error: e2 } = await supabase
          .from("message_recipients")
          .insert(ids.map((athlete_id) => ({ message_id: inserted.id, athlete_id })));
        if (e2) toast.warning("Destinataires non liés", { description: e2.message });
      }
    }
    setSending(false);
    toast.success(`Message envoyé à ${recipients} destinataires`);
    setConfirmOpen(false);
    setSubject("");
    setBody("");
    setSelectedTplId("none");
    setRecipients(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-500">Templates et envois ciblés.</p>
      </div>

      {/* Templates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Templates</h2>
          <Button onClick={openCreateTpl} className="bg-indigo-500 hover:bg-indigo-600">
            <Plus className="mr-2 h-4 w-4" /> Créer template
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <TableSkeleton cols={5} />
          ) : templates.length === 0 ? (
            <div className="p-6"><EmptyState message="Aucun template." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.subject}</TableCell>
                    <TableCell><Badge variant="outline">{t.channel}</Badge></TableCell>
                    <TableCell>
                      {t.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Oui</Badge>
                      ) : (
                        <Badge variant="outline">Non</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditTpl(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setTplDel(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Bulk send */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Envoi groupé</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Template (optionnel)</Label>
              <Select value={selectedTplId} onValueChange={setSelectedTplId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Saisie libre</SelectItem>
                  {templates.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Sujet</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Corps</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select value={audKind} onValueChange={(v) => setAudKind(v as Audience["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_athletes">Tous les athlètes</SelectItem>
                  <SelectItem value="delegation">Délégation d'un Games</SelectItem>
                  <SelectItem value="federation">Athlètes d'une fédération</SelectItem>
                  <SelectItem value="staff">Encadrement</SelectItem>
                </SelectContent>
              </Select>
              {audKind === "delegation" && (
                <Select value={audGameId} onValueChange={setAudGameId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un Games" /></SelectTrigger>
                  <SelectContent>
                    {games.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {audKind === "federation" && (
                <Select value={audFedId} onValueChange={setAudFedId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une fédération" /></SelectTrigger>
                  <SelectContent>
                    {feds.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={startSend} className="bg-indigo-500 hover:bg-indigo-600">
              <Send className="mr-2 h-4 w-4" /> Envoyer
            </Button>
          </div>
        </div>
      </section>

      {/* Template dialog */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tplEdit ? "Modifier le template" : "Créer un template"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nom</Label>
              <Input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={tplForm.channel} onValueChange={(v) => setTplForm({ ...tplForm, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="block">Actif</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={tplForm.is_active}
                  onCheckedChange={(v) => setTplForm({ ...tplForm, is_active: v })}
                />
                <span className="text-sm text-slate-600">{tplForm.is_active ? "Activé" : "Désactivé"}</span>
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Sujet</Label>
              <Input value={tplForm.subject} onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Corps</Label>
              <Textarea
                value={tplForm.body}
                onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplOpen(false)}>Annuler</Button>
            <Button onClick={submitTpl} className="bg-indigo-500 hover:bg-indigo-600">
              {tplEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tplDel} onOpenChange={(o) => !o && setTplDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeTpl} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm send */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi</DialogTitle>
            <DialogDescription>
              Audience : <span className="font-medium text-slate-700">{audienceLabel(audience)}</span>
              <br />
              Destinataires : <span className="font-semibold">{recipients ?? 0}</span>
              <br />
              Canal : <span className="font-medium text-slate-700">{channel}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button
              onClick={confirmSend}
              disabled={sending}
              className="bg-indigo-500 hover:bg-indigo-600"
            >
              {sending ? "Envoi…" : "Confirmer l'envoi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
