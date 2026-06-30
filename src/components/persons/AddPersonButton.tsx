import { useEffect, useMemo, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import type { PersonRoleType } from "@/lib/persons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PersonCombobox } from "@/components/PersonCombobox";
import { PersonCreateDialog } from "@/components/persons/PersonCreateDialog";
import { AddRoleDialog } from "@/components/persons/AddRoleDialog";

type PersonLite = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  role: PersonRoleType;
  label: string;
  title?: string;
  onChanged?: (personId: string) => void;
};

export function AddPersonButton({ role, label, title, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [persons, setPersons] = useState<PersonLite[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [activePerson, setActivePerson] = useState<PersonLite | null>(null);

  const loadPersons = async () => {
    const { data, error } = await supabase
      .from("persons")
      .select("id, first_name, last_name, birth_date, gender, nationality, email, phone")
      .eq("is_active", true)
      .order("last_name");
    if (error) {
      toast.error("Chargement des personnes", { description: friendlyError(error) });
      return;
    }
    setPersons((data ?? []) as PersonLite[]);
  };

  useEffect(() => {
    if (open) loadPersons();
  }, [open]);

  const options = useMemo(
    () =>
      persons.map((p) => ({
        id: p.id,
        label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
      })),
    [persons],
  );

  const handlePick = (id: string) => {
    setSelectedId(id);
    const p = persons.find((x) => x.id === id);
    if (!p) return;
    setActivePerson(p);
    setOpen(false);
    setAddRoleOpen(true);
  };

  const handleCreateNew = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[min(360px,calc(100vw-2rem))] p-3"
          align="start"
          sideOffset={4}
        >
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <UserPlus className="h-3.5 w-3.5" />
              {title ?? label}
            </Label>
            <p className="text-xs text-muted-foreground">
              Sélectionnez une personne existante ou créez-en une nouvelle.
            </p>
            <PersonCombobox
              value={selectedId}
              onChange={handlePick}
              options={options}
              placeholder="Rechercher une personne…"
              searchPlaceholder="Nom, prénom, email…"
              onCreateNew={handleCreateNew}
              createNewLabel="Créer une nouvelle personne"
            />
          </div>
        </PopoverContent>
      </Popover>

      <PersonCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialRoles={[role]}
        onCreated={(personId) => {
          setSelectedId("");
          onChanged?.(personId);
        }}
      />

      {activePerson && (
        <AddRoleDialog
          open={addRoleOpen}
          onOpenChange={(o) => {
            setAddRoleOpen(o);
            if (!o) {
              setActivePerson(null);
              setSelectedId("");
            }
          }}
          personId={activePerson.id}
          person={{
            first_name: activePerson.first_name,
            last_name: activePerson.last_name,
            birth_date: activePerson.birth_date,
            gender: activePerson.gender,
            nationality: activePerson.nationality,
            email: activePerson.email,
            phone: activePerson.phone,
          }}
          role={role}
          onAdded={() => {
            const id = activePerson.id;
            setAddRoleOpen(false);
            setActivePerson(null);
            setSelectedId("");
            onChanged?.(id);
          }}
        />
      )}
    </>
  );
}