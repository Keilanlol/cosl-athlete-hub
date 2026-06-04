import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { ROLE_LABELS, type PersonRoleType } from "@/lib/persons";
import {
  COACH_ROLES as COACH_ROLE_OPTIONS,
  FEDERATION_MEMBER_ROLES as FED_ROLE_OPTIONS,
  CLUB_MEMBER_ROLES as CLUB_ROLE_OPTIONS,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PersonLite = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  person: PersonLite;
  role: PersonRoleType;
  onAdded: () => void;
};

const COACH_ROLES = COACH_ROLE_OPTIONS;
const FED_ROLES = FED_ROLE_OPTIONS;
const CLUB_ROLES = CLUB_ROLE_OPTIONS;
const ATHLETE_STATUSES = ["active", "injured", "suspended", "retired", "ambassador"];
const ATHLETE_LEVELS_FALLBACK = ["elite", "promotion", "espoir", "olympic_contract"];

async function nextCoslId(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("athletes")
    .select("cosl_id")
    .ilike("cosl_id", `COSL-${year}-%`)
    .order("cosl_id", { ascending: false })
    .limit(1);
  const last = data?.[0]?.cosl_id as string | undefined;
  const seq = last ? parseInt(last.split("-")[2] ?? "0", 10) + 1 : 1;
  return `COSL-${year}-${String(seq).padStart(4, "0")}`;
}

export function AddRoleDialog({
  open,
  onOpenChange,
  personId,
  person,
  role,
  onAdded,
}: Props) {
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [federations, setFederations] = useState<
    { id: string; name: string; acronym: string | null }[]
  >([]);
  const [clubs, setClubs] = useState<
    { id: string; name: string; federation_id: string | null }[]
  >([]);
  const [levels, setLevels] = useState<string[]>(ATHLETE_LEVELS_FALLBACK);
  const [saving, setSaving] = useState(false);

  // Role-specific form state
  const [athlete, setAthlete] = useState({
    primary_sport_id: "",
    primary_federation_id: "",
    current_club_id: "",
    status: "active",
    level: "promotion",
    license_number: "",
    passport_number: "",
    passport_expiry: "",
  });
  const [coach, setCoach] = useState({ role: "coach", federation_id: "", club_id: "" });
  const [fedMember, setFedMember] = useState({
    federation_id: "",
    role: "president",
    start_date: "",
  });
  const [clubMember, setClubMember] = useState({
    club_id: "",
    role: "president",
    start_date: "",
  });

  useEffect(() => {
    if (!open) return;
    // reset per-open
    setAthlete({
      primary_sport_id: "",
      primary_federation_id: "",
      current_club_id: "",
      status: "active",
      level: "promotion",
      license_number: "",
      passport_number: "",
      passport_expiry: "",
    });
    setCoach({ role: "coach", federation_id: "", club_id: "" });
    setFedMember({ federation_id: "", role: "president", start_date: "" });
    setClubMember({ club_id: "", role: "president", start_date: "" });

    supabase
      .from("sports")
      .select("id, name")
      .order("name")
      .then(({ data }) => setSports((data ?? []) as typeof sports));
    supabase
      .from("federations")
      .select("id, name, acronym")
      .order("acronym")
      .then(({ data }) => setFederations((data ?? []) as typeof federations));
    supabase
      .from("clubs")
      .select("id, name, federation_id")
      .order("name")
      .then(({ data }) => setClubs((data ?? []) as typeof clubs));
    supabase
      .from("athlete_levels_ref")
      .select("code")
      .then(({ data }) => {
        const codes = (data ?? [])
          .map((r: { code?: string }) => r.code)
          .filter((c): c is string => !!c);
        if (codes.length > 0) setLevels(codes);
      });
  }, [open]);

  const filteredClubsAthlete = athlete.primary_federation_id
    ? clubs.filter((c) => c.federation_id === athlete.primary_federation_id)
    : clubs;
  const filteredClubsCoach = coach.federation_id
    ? clubs.filter((c) => c.federation_id === coach.federation_id)
    : clubs;

  const athleteBlocked =
    role === "athlete" && (!person.birth_date || !person.gender);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (role === "athlete") {
        if (!person.birth_date || !person.gender) {
          throw new Error(
            "Renseigner d'abord la date de naissance et le genre sur la fiche personne",
          );
        }
        const cosl_id = await nextCoslId();
        const { data: legAth, error: lae } = await supabase
          .from("athletes")
          .insert({
            cosl_id,
            first_name: person.first_name,
            last_name: person.last_name,
            birth_date: person.birth_date,
            gender: person.gender,
            nationality: person.nationality ?? "LUX",
            email: person.email ?? null,
            phone: person.phone ?? null,
            is_active: true,
            status: athlete.status,
            level: athlete.level || null,
            primary_sport_id: athlete.primary_sport_id || null,
            primary_federation_id: athlete.primary_federation_id || null,
            current_club_id: athlete.current_club_id || null,
            license_number: athlete.license_number || null,
            passport_number: athlete.passport_number || null,
            passport_expiry: athlete.passport_expiry || null,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lae || !legAth) throw lae ?? new Error("Athlète legacy KO");
        const legacyAthleteId = legAth.id as string;

        const { error: ape } = await supabase.from("athlete_profiles").insert({
          person_id: personId,
          legacy_athlete_id: legacyAthleteId,
          cosl_id,
          primary_sport_id: athlete.primary_sport_id || null,
          primary_federation_id: athlete.primary_federation_id || null,
          current_club_id: athlete.current_club_id || null,
          status: athlete.status,
          level: athlete.level || null,
          license_number: athlete.license_number || null,
          passport_number: athlete.passport_number || null,
          passport_expiry: athlete.passport_expiry || null,
        });
        if (ape) throw ape;

        await supabase
          .from("athlete_kyc")
          .insert({ athlete_id: legacyAthleteId, global_status: "red" });
      } else if (role === "coach") {
        const { data: legCoach, error: lce } = await supabase
          .from("coaches")
          .insert({
            first_name: person.first_name,
            last_name: person.last_name,
            email: person.email ?? null,
            phone: person.phone ?? null,
            role: coach.role,
            federation_id: coach.federation_id || null,
            club_id: coach.club_id || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lce || !legCoach) throw lce ?? new Error("Coach legacy KO");

        const { error: cpe } = await supabase.from("coach_profiles").insert({
          person_id: personId,
          legacy_coach_id: legCoach.id,
          role: coach.role,
          federation_id: coach.federation_id || null,
          club_id: coach.club_id || null,
          is_active: true,
        });
        if (cpe) throw cpe;
      } else if (role === "federation_member") {
        if (!fedMember.federation_id) throw new Error("Fédération requise");
        const { data: legFm, error: lfe } = await supabase
          .from("federation_members")
          .insert({
            federation_id: fedMember.federation_id,
            first_name: person.first_name,
            last_name: person.last_name,
            role: fedMember.role,
            start_date: fedMember.start_date || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lfe || !legFm) throw lfe ?? new Error("Membre fédération legacy KO");

        const { error: fpe } = await supabase
          .from("federation_member_profiles")
          .insert({
            person_id: personId,
            legacy_federation_member_id: legFm.id,
            federation_id: fedMember.federation_id,
            role: fedMember.role,
            start_date: fedMember.start_date || null,
            is_active: true,
          });
        if (fpe) throw fpe;
      } else if (role === "club_member") {
        if (!clubMember.club_id) throw new Error("Club requis");
        const { data: legCm, error: lce } = await supabase
          .from("club_members")
          .insert({
            club_id: clubMember.club_id,
            first_name: person.first_name,
            last_name: person.last_name,
            role: clubMember.role,
            start_date: clubMember.start_date || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lce || !legCm) throw lce ?? new Error("Membre club legacy KO");

        const { error: cpe } = await supabase.from("club_member_profiles").insert({
          person_id: personId,
          legacy_club_member_id: legCm.id,
          club_id: clubMember.club_id,
          role: clubMember.role,
          start_date: clubMember.start_date || null,
          is_active: true,
        });
        if (cpe) throw cpe;
      }

      // Toujours : person_roles
      const { error: pre } = await supabase
        .from("person_roles")
        .insert({ person_id: personId, role_type: role });
      if (pre) throw pre;

      toast.success("Rôle ajouté");
      onAdded();
      onOpenChange(false);
    } catch (err) {
      toast.error("Échec de l'ajout", { description: friendlyError(err as never) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Ajouter le rôle « {ROLE_LABELS[role]} » — {person.first_name}{" "}
            {person.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {role === "athlete" && athleteBlocked && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Renseigne d'abord la date de naissance et le genre sur la fiche personne
              (champs requis pour créer un athlète).
            </p>
          )}

          {role === "athlete" && !athleteBlocked && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sport principal</Label>
                  <Select
                    value={athlete.primary_sport_id}
                    onValueChange={(v) =>
                      setAthlete({ ...athlete, primary_sport_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {sports.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fédération</Label>
                  <Select
                    value={athlete.primary_federation_id}
                    onValueChange={(v) =>
                      setAthlete({
                        ...athlete,
                        primary_federation_id: v,
                        current_club_id: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {federations.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.acronym ?? ""} — {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Club actuel</Label>
                <Select
                  value={athlete.current_club_id}
                  onValueChange={(v) =>
                    setAthlete({ ...athlete, current_club_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClubsAthlete.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select
                    value={athlete.status}
                    onValueChange={(v) => setAthlete({ ...athlete, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATHLETE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Niveau</Label>
                  <Select
                    value={athlete.level}
                    onValueChange={(v) => setAthlete({ ...athlete, level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>N° licence</Label>
                  <Input
                    value={athlete.license_number}
                    onChange={(e) =>
                      setAthlete({ ...athlete, license_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Passeport n°</Label>
                  <Input
                    value={athlete.passport_number}
                    onChange={(e) =>
                      setAthlete({ ...athlete, passport_number: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Expiration passeport</Label>
                <Input
                  type="date"
                  value={athlete.passport_expiry}
                  onChange={(e) =>
                    setAthlete({ ...athlete, passport_expiry: e.target.value })
                  }
                />
              </div>
            </section>
          )}

          {role === "coach" && (
            <section className="space-y-3">
              <div className="space-y-1.5">
                <Label>Fonction</Label>
                <Select
                  value={coach.role}
                  onValueChange={(v) => setCoach({ ...coach, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COACH_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fédération</Label>
                  <Select
                    value={coach.federation_id}
                    onValueChange={(v) =>
                      setCoach({ ...coach, federation_id: v, club_id: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {federations.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.acronym ?? ""} — {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Club</Label>
                  <Select
                    value={coach.club_id}
                    onValueChange={(v) => setCoach({ ...coach, club_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClubsCoach.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          )}

          {role === "federation_member" && (
            <section className="space-y-3">
              <div className="space-y-1.5">
                <Label>Fédération *</Label>
                <Select
                  value={fedMember.federation_id}
                  onValueChange={(v) =>
                    setFedMember({ ...fedMember, federation_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {federations.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.acronym ?? ""} — {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rôle *</Label>
                  <Select
                    value={fedMember.role}
                    onValueChange={(v) => setFedMember({ ...fedMember, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FED_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Depuis</Label>
                  <Input
                    type="date"
                    value={fedMember.start_date}
                    onChange={(e) =>
                      setFedMember({ ...fedMember, start_date: e.target.value })
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {role === "club_member" && (
            <section className="space-y-3">
              <div className="space-y-1.5">
                <Label>Club *</Label>
                <Select
                  value={clubMember.club_id}
                  onValueChange={(v) =>
                    setClubMember({ ...clubMember, club_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rôle *</Label>
                  <Select
                    value={clubMember.role}
                    onValueChange={(v) => setClubMember({ ...clubMember, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLUB_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Depuis</Label>
                  <Input
                    type="date"
                    value={clubMember.start_date}
                    onChange={(e) =>
                      setClubMember({ ...clubMember, start_date: e.target.value })
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {(role === "official" || role === "volunteer" || role === "staff") && (
            <p className="text-sm text-muted-foreground">
              Aucune information supplémentaire requise pour ce rôle.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || athleteBlocked}
          >
            {saving ? "Ajout…" : "Ajouter le rôle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
