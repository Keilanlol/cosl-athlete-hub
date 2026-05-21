import { useRef, useState } from "react";
import { Camera, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface AthletePhotoUploadProps {
  /** null si on est en cours de création (pas encore d'ID) */
  athleteId: string | null;
  currentPhotoUrl?: string | null;
  /** Appelé après upload réussi. `docId` est null en mode création (pas d'enregistrement DB). */
  onUploaded: (url: string, docId: string | null, file?: File) => void;
  /** Mode création : ne touche pas au storage tant qu'il n'y a pas d'ID, juste un preview local. */
  pendingPreviewOnly?: boolean;
  size?: "sm" | "lg";
  initials?: string;
  className?: string;
}

export function AthletePhotoUpload({
  athleteId,
  currentPhotoUrl,
  onUploaded,
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
      const path = `athletes/${athleteId}/photo/photo_identite.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

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

      onUploaded(signedUrl, docId);
      toast.success("Photo mise à jour");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'upload";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const displayed = localPreview ?? currentPhotoUrl ?? null;

  return (
    <div className={cn("inline-block", className)}>
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
            "rounded-full overflow-hidden border-2 bg-slate-100 flex items-center justify-center",
            dim,
            displayed ? "border-slate-200" : "border-dashed border-slate-300",
          )}
        >
          {displayed ? (
            <img src={displayed} alt="Photo" className="w-full h-full object-cover" />
          ) : initials ? (
            <span className="font-semibold text-slate-500">{initials}</span>
          ) : (
            <UserCircle className={cn(iconSize, "text-slate-400")} />
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
