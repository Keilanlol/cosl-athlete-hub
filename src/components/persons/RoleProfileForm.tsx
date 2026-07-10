import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/lib/types";
import type { PersonRoleType } from "@/lib/persons";
import type {
  AthleteProfileFields,
  CoachProfileFields,
  FedMemberProfileFields,
} from "@/lib/persons";

type Option = { id: string; name: string };
type FedOption = { id: string; name: string; acronym: string | null };

type Props = {
  role: PersonRoleType;
  sports: Option[];
  federations: FedOption[];
  athlete: AthleteProfileFields;
  coach: CoachProfileFields;
  fedMember: FedMemberProfileFields;
  onAthlete: (patch: Partial<AthleteProfileFields>) => void;
  onCoach: (patch: Partial<CoachProfileFields>) => void;
  onFedMember: (patch: Partial<FedMemberProfileFields>) => void;
  /** If set, the federation selector is hidden for fed member / coach sections. */
  presetFederationId?: string;
};

/**
 * Shared role-specific profile sections used by both
 * PersonCreateDialog (step "details") and AddRoleDialog.
 */
export function RoleProfileForm({
  role,
  sports,
  federations,
  athlete,
  coach,
  fedMember,
  onAthlete,
  onCoach,
  onFedMember,
  presetFederationId,
}: Props) {
  if (role === "athlete") {
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
                onAthlete({ primary_federation_id: v })
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
            <Label>Passeport n°</Label>
            <Input
              value={athlete.passport_number}
              onChange={(e) => onAthlete({ passport_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expiration passeport</Label>
            <Input
              type="date"
              value={athlete.passport_expiry}
              onChange={(e) => onAthlete({ passport_expiry: e.target.value })}
            />
          </div>
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
        <div className="space-y-1.5">
          {presetFed ? (
            <>
              <Label>Fédération</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {presetFed.acronym ?? ""} — {presetFed.name}
              </div>
            </>
          ) : (
            <>
              <Label>Fédération</Label>
              <Select
                value={coach.federation_id}
                onValueChange={(v) =>
                  onCoach({ federation_id: v })
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
            </>
          )}
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
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            value={fedMember.notes}
            onChange={(e) => onFedMember({ notes: e.target.value })}
            rows={2}
          />
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