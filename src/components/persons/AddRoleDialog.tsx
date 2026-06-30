import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  ROLE_LABELS,
  fetchNextCoslId,
  defaultAthleteProfile,
  defaultCoachProfile,
  defaultFedMemberProfile,
  defaultClubMemberProfile,
  type PersonRoleType,
  type AthleteProfileFields,
  type CoachProfileFields,
  type FedMemberProfileFields,
  type ClubMemberProfileFields,
} from "@/lib/persons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { RoleProfileForm } from "@/components/persons/RoleProfileForm";

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
  presetFederationId?: string;
  presetClubId?: string;
};

export function AddRoleDialog({ open, onOpenChange, personId, person, role, onAdded, presetFederationId, presetClubId }: Props) {
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [federations, setFederations] = useState<{ id: string; name: string; acronym: string | null }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; federation_id: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  const [athlete, setAthlete] = useState<AthleteProfileFields>({ ...defaultAthleteProfile });
  const [coach, setCoach] = useState<CoachProfileFields>({ ...defaultCoachProfile });
  const [fedMember, setFedMember] = useState<FedMemberProfileFields>({ ...defaultFedMemberProfile });
  const [clubMember, setClubMember] = useState<ClubMemberProfileFields>({ ...defaultClubMemberProfile });

  // Local editable copies of person fields needed for athlete creation
  const [birthDate, setBirthDate] = useState(person.birth_date ?? "");
  const [gender, setGender] = useState(person.gender ?? "");
  // Track which fields were missing when the dialog opened (frozen until submit)
  const [showBirthDate, setShowBirthDate] = useState(false);
  const [showGender, setShowGender] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAthlete({ ...defaultAthleteProfile, current_club_id: presetClubId ?? "" });
    setCoach({ ...defaultCoachProfile, federation_id: presetFederationId ?? "" });
    setFedMember({ ...defaultFedMemberProfile, federation_id: presetFederationId ?? "" });
    setClubMember({ ...defaultClubMemberProfile, club_id: presetClubId ?? "" });
    setBirthDate(person.birth_date ?? "");
    setGender(person.gender ?? "");
    // Freeze which fields are missing at open time
    setShowBirthDate(role === "athlete" && !person.birth_date);
    setShowGender(role === "athlete" && !person.gender);

    supabase.from("sports").select("id, name").order("name")
      .then(({ data }) => setSports((data ?? []) as typeof sports));
    supabase.from("federations").select("id, name, acronym").order("acronym")
      .then(({ data }) => setFederations((data ?? []) as typeof federations));
    supabase.from("clubs").select("id, name, federation_id").order("name")
      .then(({ data }) => setClubs((data ?? []) as typeof clubs));
  }, [open]);

  const patchAthlete = (patch: Partial<AthleteProfileFields>) =>
    setAthlete((a) => ({ ...a, ...patch }));
  const patchCoach = (patch: Partial<CoachProfileFields>) =>
    setCoach((c) => ({ ...c, ...patch }));
  const patchFedMember = (patch: Partial<FedMemberProfileFields>) =>
    setFedMember((f) => ({ ...f, ...patch }));
  const patchClubMember = (patch: Partial<ClubMemberProfileFields>) =>
    setClubMember((c) => ({ ...c, ...patch }));

  const missingBirthDate = showBirthDate && !birthDate;
  const missingGender = showGender && !gender;
  const athleteBlocked = missingBirthDate || missingGender;

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (role === "athlete") {
        // Check if person already has an athlete profile
        const { data: existingAp } = await supabase
          .from("athlete_profiles")
          .select("legacy_athlete_id")
          .eq("person_id", personId)
          .maybeSingle();

        if (existingAp?.legacy_athlete_id) {
          // Already an athlete — just update current_club_id
          const { error: updErr } = await supabase
            .from("athletes")
            .update({ current_club_id: athlete.current_club_id || null })
            .eq("id", existingAp.legacy_athlete_id);
          if (updErr) throw updErr;
          const { error: apErr } = await supabase
            .from("athlete_profiles")
            .update({ current_club_id: athlete.current_club_id || null })
            .eq("person_id", personId);
          if (apErr) throw apErr;
        } else {
          if (!birthDate || !gender)
            throw new Error("Date de naissance et genre obligatoires pour les athlètes");

          // If person was missing birth_date or gender, update the person record first
          if (!person.birth_date || !person.gender) {
            const updatePayload: Record<string, string> = {};
            if (!person.birth_date && birthDate) updatePayload.birth_date = birthDate;
            if (!person.gender && gender) updatePayload.gender = gender;
            if (Object.keys(updatePayload).length > 0) {
              const { error: pe } = await supabase
                .from("persons")
                .update(updatePayload)
                .eq("id", personId);
              if (pe) throw pe;
            }
          }

          const cosl_id = await fetchNextCoslId();
          const { data: legAth, error: lae } = await supabase
            .from("athletes")
            .insert({
              cosl_id,
              first_name: person.first_name, last_name: person.last_name,
              birth_date: birthDate, gender: gender,
              nationality: person.nationality ?? "LUX",
              email: person.email ?? null, phone: person.phone ?? null,
              is_active: true, status: athlete.status, level: athlete.level || null,
              primary_sport_id: athlete.primary_sport_id || null,
              primary_federation_id: athlete.primary_federation_id || null,
              current_club_id: athlete.current_club_id || null,
              license_number: athlete.license_number || null,
              passport_number: athlete.passport_number || null,
              passport_expiry: athlete.passport_expiry || null,
              person_id: personId,
            })
            .select("id").single();
          if (lae || !legAth) throw lae ?? new Error("Athlète legacy KO");

          const { error: ape } = await supabase.from("athlete_profiles").insert({
            person_id: personId, legacy_athlete_id: legAth.id, cosl_id,
            primary_sport_id: athlete.primary_sport_id || null,
            primary_federation_id: athlete.primary_federation_id || null,
            current_club_id: athlete.current_club_id || null,
            status: athlete.status, level: athlete.level || null,
            license_number: athlete.license_number || null,
            passport_number: athlete.passport_number || null,
            passport_expiry: athlete.passport_expiry || null,
          });
          if (ape) throw ape;

          await supabase.from("athlete_kyc").insert({ athlete_id: legAth.id, global_status: "red" });
        }
      } else if (role === "coach") {
        const { data: legCoach, error: lce } = await supabase
          .from("coaches")
          .insert({
            first_name: person.first_name, last_name: person.last_name,
            email: person.email ?? null, phone: person.phone ?? null,
            role: coach.role,
            federation_id: coach.federation_id || null,
            club_id: coach.club_id || null,
            is_active: true, person_id: personId,
          })
          .select("id").single();
        if (lce || !legCoach) throw lce ?? new Error("Coach legacy KO");

        const { error: cpe } = await supabase.from("coach_profiles").insert({
          person_id: personId, legacy_coach_id: legCoach.id,
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
            first_name: person.first_name, last_name: person.last_name,
            email: person.email ?? null, phone: person.phone ?? null,
            role: fedMember.role,
            start_date: fedMember.start_date || null,
            is_active: true, person_id: personId,
          })
          .select("id").single();
        if (lfe || !legFm) throw lfe ?? new Error("Membre fédération legacy KO");

        await supabase.from("federation_member_profiles").insert({
          person_id: personId, legacy_federation_member_id: legFm.id,
          federation_id: fedMember.federation_id, role: fedMember.role,
          start_date: fedMember.start_date || null, is_active: true,
        });
      } else if (role === "club_member") {
        if (!clubMember.club_id) throw new Error("Club requis");
        const { data: legCm, error: lce } = await supabase
          .from("club_members")
          .insert({
            club_id: clubMember.club_id,
            first_name: person.first_name, last_name: person.last_name,
            email: person.email ?? null, phone: person.phone ?? null,
            role: clubMember.role,
            start_date: clubMember.start_date || null,
            is_active: true, person_id: personId,
          })
          .select("id").single();
        if (lce || !legCm) throw lce ?? new Error("Membre club legacy KO");

        await supabase.from("club_member_profiles").insert({
          person_id: personId, legacy_club_member_id: legCm.id,
          club_id: clubMember.club_id, role: clubMember.role,
          start_date: clubMember.start_date || null, is_active: true,
        });
      }

      // person_roles
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
            Ajouter le rôle « {ROLE_LABELS[role]} » — {person.first_name} {person.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Inline missing person fields for athlete creation */}
          {role === "athlete" && (showBirthDate || showGender) && (
            <div className="space-y-3 rounded-md border-2 border-red-300 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">
                Champs obligatoires pour les athlètes
              </p>
              <div className="grid grid-cols-2 gap-3">
                {showBirthDate && (
                  <div className="space-y-1.5">
                    <Label className="text-red-700">Date de naissance</Label>
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="border-red-400 focus-visible:outline-red-500"
                    />
                  </div>
                )}
                {showGender && (
                  <div className="space-y-1.5">
                    <Label className="text-red-700">Genre</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="border-red-400 focus-visible:outline-red-500">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Homme</SelectItem>
                        <SelectItem value="female">Femme</SelectItem>
                        <SelectItem value="mixed">Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          <RoleProfileForm
            role={role}
            sports={sports}
            federations={federations}
            clubs={clubs}
            athlete={athlete}
            coach={coach}
            fedMember={fedMember}
            clubMember={clubMember}
            onAthlete={patchAthlete}
            onCoach={patchCoach}
            onFedMember={patchFedMember}
            onClubMember={patchClubMember}
            presetFederationId={presetFederationId}
            presetClubId={presetClubId}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (role === "athlete" && athleteBlocked)}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            {saving ? "Ajout…" : "Ajouter le rôle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}