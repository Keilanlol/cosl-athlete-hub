import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressSearch } from "@/components/AddressSearch";
import type { PersonGeneralFields } from "@/lib/persons";

type Props = {
  values: PersonGeneralFields;
  onChange: (patch: Partial<PersonGeneralFields>) => void;
  athleteRequiresBirthGender?: boolean;
};

/**
 * Shared "Informations générales" form section used by both
 * PersonCreateDialog (step "general") and the Person edit dialog.
 */
export function PersonGeneralForm({ values, onChange, athleteRequiresBirthGender }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fn">Prénom *</Label>
          <Input
            id="fn"
            value={values.first_name}
            onChange={(e) => onChange({ first_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ln">Nom *</Label>
          <Input
            id="ln"
            value={values.last_name}
            onChange={(e) => onChange({ last_name: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bd">
            Date de naissance {athleteRequiresBirthGender && "*"}
          </Label>
          <Input
            id="bd"
            type="date"
            value={values.birth_date}
            onChange={(e) => onChange({ birth_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Genre {athleteRequiresBirthGender && "*"}
          </Label>
          <Select
            value={values.gender}
            onValueChange={(v) => onChange({ gender: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Homme</SelectItem>
              <SelectItem value="female">Femme</SelectItem>
              <SelectItem value="mixed">Mixte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="em">Email</Label>
          <Input
            id="em"
            type="email"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph">Téléphone</Label>
          <Input
            id="ph"
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nat">Nationalité</Label>
        <Input
          id="nat"
          value={values.nationality}
          onChange={(e) => onChange({ nationality: e.target.value })}
          placeholder="LUX"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="street">Adresse</Label>
        <AddressSearch
          id="street"
          value={values.street}
          onChange={(v) => onChange({ street: v })}
          onSelect={(r) =>
            onChange({
              street: r.street || r.display_name,
              postcode: r.postcode,
              city: r.city,
              country: r.country_code || r.country,
            })
          }
          placeholder="Rechercher une adresse…"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="postcode">Code postal</Label>
          <Input
            id="postcode"
            value={values.postcode}
            onChange={(e) => onChange({ postcode: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input
            id="country"
            value={values.country}
            onChange={(e) => onChange({ country: e.target.value })}
            placeholder="LU"
          />
        </div>
      </div>
    </div>
  );
}