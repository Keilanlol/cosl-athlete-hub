import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboOption = { id: string; label: string };

type Props = {
  value: string;
  onChange: (id: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  /** If provided, displays a "create new" item that calls this callback. */
  onCreateNew?: () => void;
  createNewLabel?: string;
};

export function PersonCombobox({
  value,
  onChange,
  options,
  placeholder = "Choisir…",
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat.",
  className,
  disabled,
  onCreateNew,
  createNewLabel = "Créer une nouvelle personne",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span
            className={cn(
              "truncate text-left min-w-0 flex-1",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] min-w-[320px] max-w-[min(560px,calc(100vw-2rem))]"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {onCreateNew && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__create_new__"
                    onSelect={() => {
                      onCreateNew();
                      setOpen(false);
                    }}
                    className="text-primary font-medium"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createNewLabel}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>
              {options.slice(0, 300).map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.label} ${o.id}`}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === o.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
