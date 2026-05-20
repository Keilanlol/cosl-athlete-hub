import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

let pushPending: ((p: Pending) => void) | null = null;

export function confirmAction(options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushPending) {
      // Fallback if host not mounted
      // eslint-disable-next-line no-alert
      resolve(window.confirm(options.description || options.title || "Confirmer ?"));
      return;
    }
    pushPending({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [current, setCurrent] = useState<Pending | null>(null);

  useEffect(() => {
    pushPending = (p) => setCurrent(p);
    return () => {
      pushPending = null;
    };
  }, []);

  const close = (result: boolean) => {
    if (current) current.resolve(result);
    setCurrent(null);
  };

  const destructive = current?.destructive !== false;

  return (
    <AlertDialog
      open={!!current}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current?.title ?? "Confirmer l'action"}</AlertDialogTitle>
          <AlertDialogDescription>
            {current?.description ?? "Cette action est irréversible. Voulez-vous continuer ?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {current?.cancelLabel ?? "Annuler"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={destructive ? "bg-red-600 hover:bg-red-700" : undefined}
          >
            {current?.confirmLabel ?? "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
