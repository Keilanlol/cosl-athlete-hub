import type { ReactNode } from "react";
import { KycStatusBadge } from "./KycStatusBadge";
import { Badge } from "@/components/ui/badge";

interface KycAxisProps {
  title: string;
  description: string;
  status: "green" | "orange" | "red" | null;
  required?: boolean;
  children: ReactNode;
}

export function KycAxis({ title, description, status, required, children }: KycAxisProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <KycStatusBadge status={status} size="sm" showIcon />
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            {required && (
              <Badge variant="outline" className="border-red-300 text-red-600 text-[10px]">
                Obligatoire
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-3 space-y-3">{children}</div>
    </div>
  );
}
