import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/ConfirmDialog";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;
const ONE_YEAR = 60 * 60 * 24 * 365;
const PHOTO_DIR = (athleteId: string) => `athletes/${athleteId}/photo`;

export interface AthletePhotoUploadProps {
  /** null si on est en cours de création (pas encore d'ID) */
  athleteId: string | null;
  currentPhotoUrl?: string | null;
  /** Appelé après upload réussi. `docId` est null en mode création (pas d'enregistrement DB). */
  onUploaded: (url: string, docId: string | null, file?: File) => void;
  /** Appelé après suppression réussie (ou reset du preview en mode création). */
  onDeleted?: () => void;
  /** Mode création : ne touche pas au storage tant qu'il n'y a pas d'ID, juste un preview local. */
  pendingPreviewOnly?: boolean;
  size?: "sm" | "lg";
  initials?: string;
  className?: string;
}

async function purgePhotoDir(athleteId: string, keepPath?: string) {
  const dir = PHOTO_DIR(athleteId);
  const { data: existing, error } = await supabase.storage.from("documents").list(dir);
  if (error || !existing?.length) return;
  const toRemove = existing
    .map((f) => `${dir}/${f.name}`)
    .filter((p) => p !== keepPath);
  if (toRemove.length) {
    await supabase.storage.from("documents").remove(toRemove);
  }
}

export function AthletePhotoUpload({
  athleteId,
  currentPhotoUrl,
  onUploaded,
  onDeleted,
  pendingPreviewOnly = false,
  size = "lg",
  initials,
  className,
}: AthletePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const dim = size === "lg" ? "w-24 h-24" : "w-20 h-20";
  const iconSize = size === "lg" ? "h-12 w-12" : "h-9 w-9";

  const validate = (file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) return "Format non supporté (JPG, PNG, WebP)";
    if (file.size > MAX_MB * 1024 * 1024) return `Fichier trop volumineux (max ${MAX_MB} MB)`;
    return null;
  };

  const handleFile = async (file: File) => {
    const err = validate(file);
    if (err) {
      toast.error(err);
      return;
    }

    // Mode création : preview local uniquement, l'upload arrivera plus tard
    if (pendingPreviewOnly || !athleteId) {
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
      onUploaded(url, null, file);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${PHOTO_DIR(athleteId)}/photo_identite.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // Supprime les anciennes versions (autres extensions) du dossier photo
      await purgePhotoDir(athleteId, path);

      const { data: signed, error: signErr } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, ONE_YEAR);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("URL signée impossible");
      const signedUrl = signed.signedUrl;

      // Upsert manuel : existe déjà ?
      const { data: existing } = await supabase
        .from("athlete_documents")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("doc_type", "photo_identite")
        .maybeSingle();

      let docId: string | null = existing?.id ?? null;
      if (existing) {
        const { error } = await supabase
          .from("athlete_documents")
          .update({
            file_url: signedUrl,
            file_name: file.name,
            status: "valid",
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("athlete_documents")
          .insert({
            athlete_id: athleteId,
            category: "admin",
            doc_type: "photo_identite",
            file_name: file.name,
            file_url: signedUrl,
            status: "valid",
          })
          .select("id")
          .single();
        if (error) throw error;
        docId = inserted?.id ?? null;
      }

      await supabase.from("athletes").update({ photo_url: signedUrl }).eq("id", athleteId);

      setLocalPreview(null);
      onUploaded(signedUrl, docId);
      toast.success("Photo mise à jour");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'upload";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Mode création : juste reset du preview
    if (pendingPreviewOnly || !athleteId) {
      setLocalPreview(null);
      onDeleted?.();
      return;
    }

    const ok = await confirmAction({
      title: "Supprimer la photo",
      description: "La photo officielle sera définitivement supprimée. Continuer ?",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;

    setUploading(true);
    try {
      // 1) Storage : purge tout le dossier photo
      await purgePhotoDir(athleteId);

      // 2) athlete_documents : supprime la ligne photo_identite
      const { error: delErr } = await supabase
        .from("athlete_documents")
        .delete()
        .eq("athlete_id", athleteId)
        .eq("doc_type", "photo_identite");
      if (delErr) throw delErr;

      // 3) athletes.photo_url = null
      const { error: updErr } = await supabase
        .from("athletes")
        .update({ photo_url: null })
        .eq("id", athleteId);
      if (updErr) throw updErr;

      setLocalPreview(null);
      onDeleted?.();
      toast.success("Photo supprimée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de la suppression";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const displayed = localPreview ?? currentPhotoUrl ?? null;

  return (
    <div className={cn("inline-block relative", className)}>
      <div
        className={cn(
          "relative group cursor-pointer",
          dim,
          dragging && "ring-2 ring-indigo-400 rounded-full",
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        role="button"
        aria-label="Modifier la photo"
      >
        <div
          className={cn(
            "rounded-full overflow-hidden border-2 bg-muted flex items-center justify-center",
            dim,
            displayed ? "border-border" : "border-dashed border-border",
          )}
        >
          {displayed ? (
            <img src={displayed} alt="Photo" className="w-full h-full object-cover" />
          ) : initials ? (
            <span className="font-semibold text-muted-foreground">{initials}</span>
          ) : (
            <UserCircle className={cn(iconSize, "text-muted-foreground")} />
          )}
        </div>

        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 pointer-events-none">
          <Camera className="h-5 w-5 text-white" />
          <span className="text-white text-[10px] font-medium">
            {displayed ? "Modifier" : "Ajouter"}
          </span>
        </div>

        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {displayed && !uploading && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute -top-1 -right-1 z-10 rounded-full bg-red-500 hover:bg-red-600 text-white p-1.5 shadow-md border-2 border-white transition-colors"
          aria-label="Supprimer la photo"
          title="Supprimer la photo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
