import { Badge } from "@/components/ui/badge";
import { ROLE_BADGE_CLASSES, ROLE_LABELS, type PersonRoleType } from "@/lib/persons";
import { cn } from "@/lib/utils";

export function PersonRoleBadge({
  role,
  className,
}: {
  role: PersonRoleType;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border", ROLE_BADGE_CLASSES[role], className)}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}
