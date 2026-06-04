import { useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const ONE_YEAR = 60 * 60 * 24 * 365;

export type LogoEntity = "sponsor" | "partner";

interface Props {
  /** Existing logo URL (from DB) when editing. */
  currentUrl?: string | null;
  /** Locally staged File (not yet uploaded). */
  file: File | null;
  onFileChange: (f: File | null) => void;
  /** Clear flag: when true and no file, request removing existing logo on save. */
  clearedExisting: boolean;
  onClearedExistingChange: (v: boolean) => void;
}

export function LogoFilePicker({
  currentUrl,
  file,
  onFileChange,
  clearedExisting,
  onClearedExistingChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const stagedUrl = file ? URL.createObjectURL(file) : null;
  const displayed = stagedUrl ?? (clearedExisting ? null : currentUrl ?? null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-24 w-24 rounded-lg border-2 border-dashed border-border bg-muted overflow-hidden flex items-center justify-center group"
      >
        {displayed ? (
          <img src={displayed} alt="Logo" className="h-full w-full object-contain p-1" />
        ) : (
          <Camera className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-medium">
            {displayed ? "Modifier" : "Ajouter un logo"}
          </span>
        </div>
      </button>
      {displayed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 h-7"
          onClick={() => {
            onFileChange(null);
            onClearedExistingChange(true);
          }}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Retirer
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) {
            onFileChange(f);
            onClearedExistingChange(false);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Uploads a staged logo file to the `documents` bucket and updates the
 * corresponding row's logo_url / logo_storage_path. If clearedExisting is set
 * and no new file, deletes the prior file and nulls the row.
 */
export async function persistLogo(
  entity: LogoEntity,
  id: string,
  opts: {
    file: File | null;
    clearedExisting: boolean;
    previousPath?: string | null;
  },
): Promise<void> {
  const table = entity === "sponsor" ? "sponsors" : "partners";

  if (opts.file) {
    const ext = (opts.file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${entity}s/${id}/logo/logo.${ext}`;
    if (opts.previousPath && opts.previousPath !== path) {
      await supabase.storage.from("documents").remove([opts.previousPath]);
    }
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, opts.file, { upsert: true, contentType: opts.file.type });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, ONE_YEAR);
    if (signErr || !signed?.signedUrl) throw signErr ?? new Error("URL signée impossible");
    await supabase.from(table).update({ logo_url: signed.signedUrl, logo_storage_path: path }).eq("id", id);
    return;
  }

  if (opts.clearedExisting) {
    if (opts.previousPath) {
      await supabase.storage.from("documents").remove([opts.previousPath]);
    }
    await supabase.from(table).update({ logo_url: null, logo_storage_path: null }).eq("id", id);
  }
}
