import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KycStatusBadgeProps {
  status: "green" | "orange" | "red" | null | undefined;
  label?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

const MAP = {
  green: { cls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", icon: "✅", label: "Conforme" },
  orange: { cls: "bg-amber-100 text-amber-700 hover:bg-amber-100", icon: "⚠️", label: "Partiel" },
  red: { cls: "bg-red-100 text-red-700 hover:bg-red-100", icon: "❌", label: "Non conforme" },
} as const;

export function KycStatusBadge({ status, label, size = "md", showIcon = false, className }: KycStatusBadgeProps) {
  if (!status) {
    return (
      <Badge
        className={cn(
          "bg-slate-200 text-slate-500 hover:bg-slate-200 border-transparent",
          size === "sm" && "text-[10px] px-1.5 py-0",
          className,
        )}
      >
        {label ?? "Non évalué"}
      </Badge>
    );
  }
  const m = MAP[status];
  return (
    <Badge
      className={cn(
        m.cls,
        "border-transparent",
        size === "sm" && "text-[10px] px-1.5 py-0",
        className,
      )}
    >
      {showIcon && <span className="mr-1">{m.icon}</span>}
      {label ?? m.label}
    </Badge>
  );
}
