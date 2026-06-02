import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
  country_code: string;
  state: string;
}

interface PhotonProperties {
  housenumber?: string;
  street?: string;
  name?: string;
  city?: string;
  district?: string;
  locality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
}

interface PhotonFeature {
  type: "Feature";
  properties: PhotonProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

function parseFeature(f: PhotonFeature): AddressSearchResult {
  const p = f.properties ?? {};
  const street = [p.housenumber, p.street ?? p.name].filter(Boolean).join(" ").trim();
  const city = p.city ?? p.district ?? p.locality ?? p.county ?? "";
  const [lon, lat] = f.geometry?.coordinates ?? [0, 0];
  const display_name = [street, p.postcode, city, p.country]
    .filter(Boolean)
    .join(", ");
  return {
    display_name,
    lat: String(lat),
    lon: String(lon),
    street,
    city,
    postcode: p.postcode ?? "",
    country: p.country ?? "",
    country_code: (p.countrycode ?? "").toUpperCase(),
    state: p.state ?? "",
  };
}

interface AddressSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: AddressSearchResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function AddressSearch({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  id,
}: AddressSearchProps) {
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3 || q === lastQueryRef.current) {
      if (q.length < 3) {
        setResults([]);
        setSearched(false);
        setOpen(false);
      }
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = `/api/photon?q=${encodeURIComponent(q)}&limit=5&lang=fr`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data: PhotonResponse = await res.json();
        lastQueryRef.current = q;
        setResults(data.features ?? []);
        setSearched(true);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
          setSearched(true);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (f: PhotonFeature) => {
    const parsed = parseFeature(f);
    onChange(parsed.street || parsed.city || parsed.display_name);
    onSelect?.(parsed);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-72 overflow-auto">
          {results.length === 0 && searched && !loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Aucune adresse trouvée</div>
          ) : (
            results.map((f, i) => {
              const p = parseFeature(f);
              const secondary = [p.city, p.postcode, p.country]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={`${p.lat}-${p.lon}-${i}`}
                  type="button"
                  onClick={() => handleSelect(f)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted border-b border-slate-100 last:border-0"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.street || p.display_name}
                    </p>
                    {secondary && (
                      <p className="text-xs text-muted-foreground truncate">{secondary}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
