import { useRef, useState } from "react";
import { Upload, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  bucket: string;
  /** Prefix path inside the bucket. The file name will be appended (sanitized). */
  path: string;
  accept?: string;
  maxSizeMb?: number;
  currentUrl?: string | null;
  currentName?: string | null;
  onUploaded: (url: string, fileName: string, storagePath: string) => void;
  onError?: (msg: string) => void;
  className?: string;
  /** Signed URL TTL in seconds (default ~1 year). */
  signedUrlTtl?: number;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,application/pdf,image/webp";
const ONE_YEAR = 60 * 60 * 24 * 365;

function sanitize(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function isImage(url: string | null | undefined, name?: string | null) {
  const s = `${url ?? ""} ${name ?? ""}`.toLowerCase();
  return /\.(png|jpe?g|webp|gif)(\?|$)/.test(s) || s.includes("image/");
}

export function FileUpload({
  bucket,
  path,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = 10,
  currentUrl,
  currentName,
  onUploaded,
  onError,
  className,
  signedUrlTtl = ONE_YEAR,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const acceptedList = accept.split(",").map((s) => s.trim()).filter(Boolean);

  const fail = (msg: string) => {
    toast.error(msg);
    onError?.(msg);
  };

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMb * 1024 * 1024) {
      fail(`Fichier trop volumineux (max ${maxSizeMb} MB).`);
      return;
    }
    if (acceptedList.length && !acceptedList.some((a) => {
      if (a.endsWith("/*")) return file.type.startsWith(a.slice(0, -1));
      return file.type === a;
    })) {
      fail(`Type non autorisé : ${file.type || "inconnu"}.`);
      return;
    }

    const cleanName = sanitize(file.name);
    const sep = path.endsWith("/") || path.endsWith("_") || path.endsWith("-") ? "" : "/";
    const storagePath = `${path}${sep}${cleanName}`;

    setProgress(10);
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setProgress(null);
      fail(`Upload échoué : ${upErr.message}`);
      return;
    }
    setProgress(70);

    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, signedUrlTtl);
    setProgress(100);
    if (signErr || !signed?.signedUrl) {
      fail(`URL signée impossible : ${signErr?.message ?? "inconnu"}`);
      setProgress(null);
      return;
    }
    setTimeout(() => setProgress(null), 400);
    onUploaded(signed.signedUrl, file.name, storagePath);
    toast.success("Fichier téléversé");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const showImage = currentUrl && isImage(currentUrl, currentName);

  return (
    <div className={cn("space-y-2", className)}>
      {currentUrl && (
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2">
          {showImage ? (
            <img
              src={currentUrl}
              alt={currentName ?? "aperçu"}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <FileText className="h-8 w-8 text-slate-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">
              {currentName ?? "Fichier actuel"}
            </p>
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              <Eye className="h-3 w-3" /> Aperçu
            </a>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center transition-colors",
          dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
        )}
      >
        <Upload className="mb-1 h-5 w-5 text-slate-400" />
        <p className="text-xs text-slate-600">
          Glissez-déposez ou <span className="font-medium text-indigo-600">parcourez</span>
        </p>
        <p className="text-[10px] text-slate-400">
          {accept.replace(/,/g, ", ")} · max {maxSizeMb} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-slate-500">Téléversement… {progress}%</p>
        </div>
      )}
    </div>
  );
}

/** Best-effort extraction of a storage path from a signed URL produced by createSignedUrl. */
export function pathFromSignedUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/object/sign/${bucket}/`;
    const i = u.pathname.indexOf(marker);
    if (i === -1) {
      const pubMarker = `/object/public/${bucket}/`;
      const j = u.pathname.indexOf(pubMarker);
      if (j === -1) return null;
      return decodeURIComponent(u.pathname.slice(j + pubMarker.length));
    }
    return decodeURIComponent(u.pathname.slice(i + marker.length));
  } catch {
    return null;
  }
}
