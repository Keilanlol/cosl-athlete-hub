import { useRef, useState } from "react";
import { Building2, Camera, Loader2, Trash2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/ConfirmDialog";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;
const ONE_YEAR = 60 * 60 * 24 * 365;

export type EntityType = "federation" | "club" | "federation_member" | "coach";

export interface EntityImageUploadProps {
  entityId: string;
  entityType: EntityType;
  currentImageUrl?: string | null;
  currentStoragePath?: string | null;
  onUploaded: (url: string, storagePath: string) => void;
  onDeleted?: () => void;
  shape?: "circle" | "square";
  size?: "sm" | "lg";
  label?: string;
  placeholder?: string;
  className?: string;
}

const buildStoragePath = (entityType: EntityType, entityId: string, ext: string) => {
  switch (entityType) {
    case "federation":
      return `federations/${entityId}/logo/logo.${ext}`;
    case "club":
      return `clubs/${entityId}/logo/logo.${ext}`;
    case "federation_member":
      return `federation-members/${entityId}/photo/photo.${ext}`;
    case "coach":
      return `coaches/${entityId}/photo/photo.${ext}`;
  }
};

export function EntityImageUpload({
  entityId,
  entityType,
  currentImageUrl,
  currentStoragePath,
  onUploaded,
  onDeleted,
  shape = "circle",
  size = "lg",
  label,
  placeholder,
  className,
}: EntityImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const dim = size === "lg" ? "w-24 h-24" : "w-10 h-10";
  const iconSize = size === "lg" ? "h-10 w-10" : "h-5 w-5";
  const radius = shape === "circle" ? "rounded-full" : "rounded-lg";
  const fit = shape === "circle" ? "object-cover" : "object-contain p-1";
  const FallbackIcon = shape === "circle" ? UserCircle : Building2;

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
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = buildStoragePath(entityType, entityId, ext);

      // Si l'ancien fichier avait une extension différente, on le purge
      if (currentStoragePath && currentStoragePath !== path) {
        await supabase.storage.from("documents").remove([currentStoragePath]);
      }

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, ONE_YEAR);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("URL signée impossible");

      onUploaded(signed.signedUrl, path);
      toast.success("Image mise à jour");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'upload";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmAction({
      title: "Supprimer cette image ?",
      description: "L'image sera définitivement supprimée. Continuer ?",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setUploading(true);
    try {
      if (currentStoragePath) {
        await supabase.storage.from("documents").remove([currentStoragePath]);
      }
      onDeleted?.();
      toast.success("Image supprimée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de la suppression";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const displayed = currentImageUrl ?? null;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div className="relative">
        <div
          className={cn(
            "relative group cursor-pointer",
            dim,
            dragging && `ring-2 ring-indigo-400 ${radius}`,
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
          aria-label="Modifier l'image"
        >
          <div
            className={cn(
              "overflow-hidden border-2 bg-slate-100 flex items-center justify-center",
              radius,
              dim,
              displayed ? "border-slate-200" : "border-dashed border-slate-300",
            )}
          >
            {displayed ? (
              <img src={displayed} alt={label ?? "Image"} className={cn("w-full h-full", fit)} />
            ) : placeholder ? (
              <span className="font-semibold text-slate-500 text-sm">{placeholder}</span>
            ) : (
              <FallbackIcon className={cn(iconSize, "text-slate-400")} />
            )}
          </div>

          <div
            className={cn(
              "absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 pointer-events-none",
              radius,
            )}
          >
            <Camera className={cn(size === "lg" ? "h-5 w-5" : "h-4 w-4", "text-white")} />
            {size === "lg" && (
              <span className="text-white text-[10px] font-medium">
                {displayed ? "Modifier" : "Ajouter"}
              </span>
            )}
          </div>

          {uploading && (
            <div className={cn("absolute inset-0 bg-black/60 flex items-center justify-center", radius)}>
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {displayed && !uploading && (
          <button
            type="button"
            onClick={handleDelete}
            className="absolute -top-1 -right-1 z-10 rounded-full bg-red-500 hover:bg-red-600 text-white p-1.5 shadow-md border-2 border-white transition-colors"
            aria-label="Supprimer l'image"
            title="Supprimer l'image"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {label && <span className="text-xs text-slate-500">{label}</span>}

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
