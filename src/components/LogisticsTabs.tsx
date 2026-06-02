import { Link, useLocation } from "@tanstack/react-router";

type Tab = {
  to: "/games/$id/logistics" | "/games/$id/logistics/flights" | "/games/$id/logistics/lodging" | "/games/$id/logistics/transport";
  label: string;
  exact?: boolean;
};

const TABS: Tab[] = [
  { to: "/games/$id/logistics", label: "Plans de voyage", exact: true },
  { to: "/games/$id/logistics/flights", label: "Vols" },
  { to: "/games/$id/logistics/lodging", label: "Hébergement" },
  { to: "/games/$id/logistics/transport", label: "Transports locaux" },
];

export function LogisticsTabs({ id }: { id: string }) {
  const location = useLocation();
  const base = `/games/${id}/logistics`;
  return (
    <nav className="flex gap-1 border-b border-border overflow-x-auto">
      {TABS.map((t) => {
        const full = t.to.replace("$id", id);
        const active = t.exact
          ? location.pathname === full || location.pathname === full + "/"
          : location.pathname.startsWith(full);
        return (
          <Link
            key={t.to}
            to={t.to}
            params={{ id }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? "border-indigo-500 text-[var(--lux-blue)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
