import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  city?: string;
  country?: string;
  postcode?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
    postcode?: string;
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
  const [results, setResults] = useState<NominatimResult[]>([]);
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
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          q,
        )}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "Accept-Language": "fr" },
        });
        const data: NominatimResult[] = await res.json();
        lastQueryRef.current = q;
        setResults(data);
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

  const handleSelect = (r: NominatimResult) => {
    const city =
      r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality;
    onChange(r.display_name);
    onSelect?.({
      display_name: r.display_name,
      lat: r.lat,
      lon: r.lon,
      city,
      country: r.address?.country,
      postcode: r.address?.postcode,
    });
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
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-72 overflow-auto">
          {results.length === 0 && searched && !loading ? (
            <div className="px-3 py-2 text-sm text-slate-500">Aucune adresse trouvée</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lon}-${i}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span className="text-slate-700">{r.display_name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
