import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { confirmAction } from "@/components/ConfirmDialog";

export type EditableOption = { value: string; label: string };

const NONE = "__none__";
const ADD = "__add__";

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  options: EditableOption[];
  placeholder?: string;
  emptyLabel?: string;
  /** Callback called when user adds a new value. Receives the trimmed label. */
  onAdd?: (label: string) => Promise<unknown> | unknown;
  /** Callback called when user deletes an option. Receives the option value. */
  onDelete?: (value: string) => Promise<unknown> | unknown;
  manageTitle?: string;
  addLabel?: string;
  /** Optional extra fields to render inside the add dialog (e.g. category). */
  extraAddFields?: ReactNode;
  /** If true, allow non-admins to use the add/delete features. Defaults to admin only. */
  allowNonAdmin?: boolean;
  className?: string;
};

export function EditableSelect({
  value,
  onValueChange,
  options,
  placeholder = "—",
  emptyLabel,
  onAdd,
  onDelete,
  manageTitle = "Gérer la liste",
  addLabel = "+ Ajouter…",
  extraAddFields,
  allowNonAdmin = false,
  className,
}: Props) {
  const { role } = useAuth();
  const isAdmin = allowNonAdmin || role === "admin";
  const canEdit = isAdmin && !!onAdd;

  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSelect = (v: string) => {
    if (v === ADD) {
      setOpen(true);
      return;
    }
    if (v === NONE) {
      onValueChange("");
      return;
    }
    onValueChange(v);
  };

  const submitAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed || !onAdd) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setNewLabel("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (v: string) => {
    if (!onDelete) return;
    const opt = options.find((o) => o.value === v);
    const ok = await confirmAction({
      title: "Supprimer cet élément ?",
      description: `Voulez-vous vraiment supprimer « ${opt?.label ?? v} » ?`,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(v);
      if (value === v) onValueChange("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Select value={value || NONE} onValueChange={handleSelect}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {canEdit && (
            <>
              <SelectSeparator />
              <SelectItem value={ADD} className="text-[var(--lux-blue)] font-medium">
                {addLabel}
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{manageTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {onDelete && options.length > 0 && (
                <div className="max-h-60 overflow-auto rounded border divide-y">
                  {options.map((o) => (
                    <div
                      key={o.value}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>{o.label}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(o.value)}
                        disabled={busy}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {extraAddFields}
              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle valeur"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitAdd();
                    }
                  }}
                  autoFocus
                />
                <Button type="button" onClick={submitAdd} disabled={!newLabel.trim() || busy}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
