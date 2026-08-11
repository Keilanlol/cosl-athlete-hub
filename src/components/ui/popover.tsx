import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

// Détecte automatiquement si le Popover est rendu à l'intérieur d'un Dialog
// modal. Si oui, on porte le contenu du Popover DANS le Dialog plutôt qu'à
// la racine du body. Sans ça, react-remove-scroll (utilisé par Radix Dialog)
// bloque les événements wheel sur tout ce qui est extérieur au DialogContent,
// rendant la molette inopérante dans les listes (Command, Select) du Popover.
//
// Détection : au montage du PopoverContent, on cherche le DialogContent
// actuellement ouvert (role="dialog" + data-state="open"). On l'utilise comme
// container du Portal. Hors dialogue, on retombe sur le body (comportement
// par défaut de Radix).
//
// Le z-index du PopoverContent reste z-50, identique au DialogContent. Comme
// le Popover est porté DANS le DialogContent, il s'affiche au-dessus grâce à
// l'ordre du DOM (après le contenu du dialogue).

function useDialogContainer() {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    // Chercher le DialogContent ouvert le plus proche dans le DOM.
    // Radix Dialog pose role="dialog" et data-state="open" sur le content.
    const dialog = document.querySelector('[role="dialog"][data-state="open"]');
    if (dialog instanceof HTMLElement) {
      setContainer(dialog);
    } else {
      setContainer(null);
    }
  }, []);

  return container;
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  const container = useDialogContainer();

  return (
    <PopoverPrimitive.Portal container={container ?? undefined}>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-popover-content-transform-origin)",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };