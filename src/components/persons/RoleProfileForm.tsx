import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATHLETE_STATUSES,
  COACH_ROLES,
  FEDERATION_MEMBER_ROLES,
  CLUB_MEMBER_ROLES,
} from "@/lib/types";
import type { PersonRoleType } from "@/lib/persons";
import type {
  AthleteProfileFields,
  CoachProfileFields,
  FedMemberProfileFields,
  ClubMemberProfileFields,
} from "@/lib/persons";

type Option = { id: string; name: string };
type FedOption = { id: string; name: string; acronym: string | null };
type ClubOption = { id: string; name: string; federation_id: string | null };

type Props = {
  role: PersonRoleType;
  sports: Option[];
  federations: FedOption[];
  clubs: ClubOption[];
  athlete: AthleteProfileFields;
  coach: CoachProfileFields;
  fedMember: FedMemberProfileFields;
  clubMember: ClubMemberProfileFields;
  onAthlete: (patch: Partial<AthleteProfileFields>) => void;
  onCoach: (patch: Partial<CoachProfileFields>) => void;
  onFedMember: (patch: Partial<FedMemberProfileFields>) => void;
  onClubMember: (patch: Partial<ClubMemberProfileFields>) => void;
  athleteBlocked?: boolean;
  /** If set, the federation selector is hidden for fed member / coach sections. */
  presetFederationId?: string;
  /** If set, the club selector is hidden for club member sections. */
  presetClubId?: string;
};

/**
 * Shared role-specific profile sections used by both
 * PersonCreateDialog (step "details") and AddRoleDialog.
 */
export function RoleProfileForm({
  role,
  sports,
  federations,
  clubs,
  athlete,
  coach,
  fedMember,
  clubMember,
  onAthlete,
  onCoach,
  onFedMember,
  onClubMember,
  athleteBlocked,
  presetFederationId,
  presetClubId,
}: Props) {
  const filteredClubsAthlete = athlete.primary_federation_id
    ? clubs.filter((c) => c.federation_id === athlete.primary_federation_id)
    : clubs;
  const filteredClubsCoach = coach.federation_id
    ? clubs.filter((c) => c.federation_id === coach.federation_id)
    : clubs;

  if (role === "athlete") {
    if (athleteBlocked) {
      return (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Renseignez d'abord la date de naissance et le genre sur la fiche personne.
        </p>
      );
    }
    return (
      <section className="space-y-3 rounded-md border border-border p-3">
        <h3 className="text-sm font-semibold">🏃 Profil Athlète</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Sport principal</Label>
            <Select
              value={athlete.primary_sport_id}
              onValueChange={(v) => onAthlete({ primary_sport_id: v })}
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
                onAthlete({ primary_federation_id: v, current_club_id: "" })
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
            onValueChange={(v) => onAthlete({ current_club_id: v })}
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
              onValueChange={(v) => onAthlete({ status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATHLETE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Niveau</Label>
            <Input
              value={athlete.level}
              onChange={(e) => onAthlete({ level: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>N° licence</Label>
            <Input
              value={athlete.license_number}
              onChange={(e) => onAthlete({ license_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Passeport n°</Label>
            <Input
              value={athlete.passport_number}
              onChange={(e) => onAthlete({ passport_number: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Expiration passeport</Label>
          <Input
            type="date"
            value={athlete.passport_expiry}
            onChange={(e) => onAthlete({ passport_expiry: e.target.value })}
          />
        </div>
      </section>
    );
  }

  if (role === "coach") {
    const presetFed = presetFederationId
      ? federations.find((f) => f.id === presetFederationId)
      : null;
    return (
      <section className="space-y-3 rounded-md border border-border p-3">
        <h3 className="text-sm font-semibold">🎯 Profil Encadrant</h3>
        <div className="space-y-1.5">
          <Label>Fonction</Label>
          <Select
            value={coach.role}
            onValueChange={(v) => onCoach({ role: v })}
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
          {presetFed ? (
            <div className="space-y-1.5">
              <Label>Fédération</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {presetFed.acronym ?? ""} — {presetFed.name}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Fédération</Label>
              <Select
                value={coach.federation_id}
                onValueChange={(v) =>
                  onCoach({ federation_id: v, club_id: "" })
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
          )}
          <div className="space-y-1.5">
            <Label>Club</Label>
            <Select
              value={coach.club_id}
              onValueChange={(v) => onCoach({ club_id: v })}
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
    );
  }

  if (role === "federation_member") {
    const presetFed = presetFederationId
      ? federations.find((f) => f.id === presetFederationId)
      : null;
    return (
      <section className="space-y-3 rounded-md border border-border p-3">
        <h3 className="text-sm font-semibold">🏛️ Membre de fédération</h3>
        {!presetFed && (
          <div className="space-y-1.5">
            <Label>Fédération *</Label>
            <Select
              value={fedMember.federation_id}
              onValueChange={(v) => onFedMember({ federation_id: v })}
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
        )}
        {presetFed && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Fédération : <strong>{presetFed.acronym ?? ""} — {presetFed.name}</strong>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select
              value={fedMember.role}
              onValueChange={(v) => onFedMember({ role: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEDERATION_MEMBER_ROLES.map((r) => (
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
              onChange={(e) => onFedMember({ start_date: e.target.value })}
            />
          </div>
        </div>
      </section>
    );
  }

  if (role === "club_member") {
    const presetClub = presetClubId
      ? clubs.find((c) => c.id === presetClubId)
      : null;
    return (
      <section className="space-y-3 rounded-md border border-border p-3">
        <h3 className="text-sm font-semibold">🏟️ Membre de club</h3>
        {!presetClub && (
          <div className="space-y-1.5">
            <Label>Club *</Label>
            <Select
              value={clubMember.club_id}
              onValueChange={(v) => onClubMember({ club_id: v })}
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
        )}
        {presetClub && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Club : <strong>{presetClub.name}</strong>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select
              value={clubMember.role}
              onValueChange={(v) => onClubMember({ role: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLUB_MEMBER_ROLES.map((r) => (
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
              onChange={(e) => onClubMember({ start_date: e.target.value })}
            />
          </div>
        </div>
      </section>
    );
  }

  // official, volunteer, staff
  return (
    <p className="text-sm text-muted-foreground">
      Aucune information supplémentaire requise pour ce rôle.
    </p>
  );
}