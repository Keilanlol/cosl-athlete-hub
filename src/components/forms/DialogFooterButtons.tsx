import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
};

export function DialogFooterButtons({
  onCancel,
  submitLabel = "Enregistrer",
  cancelLabel = "Annuler",
  loading,
  loadingLabel,
  className,
}: Props) {
  return (
    <div className={cn("flex justify-end gap-2", className)}>
      <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={loading}
        className="bg-primary hover:bg-[var(--cosl-red-dark)]"
      >
        {loading ? loadingLabel ?? `${submitLabel}…` : submitLabel}
      </Button>
    </div>
  );
}
