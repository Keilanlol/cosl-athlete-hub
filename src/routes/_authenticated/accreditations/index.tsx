import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useState } from "react";
import { BadgeCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ListPageHeader } from "@/components/list-table";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";
import { GAME_STATUSES, type Game } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/accreditations/")({
  component: GlobalAccreditationsPage,
});

function GlobalAccreditationsPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[] | null>(null);

  const load = async () => {
    setGames(null);
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("competition_start", { ascending: false });
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      setGames([]);
      return;
    }
    setGames((data ?? []) as Game[]);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <ListPageHeader
        icon={BadgeCheck}
        title="Accréditations"
        description="Configuration des exigences d'accréditation par Games."
      />

      <div className="rounded-lg border border-border bg-card">
        {games === null ? (
          <TableSkeleton cols={4} />
        ) : games.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun Games." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom du Games</TableHead>
                <TableHead>Édition</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.map((g) => {
                const sb = GAME_STATUSES.find((s) => s.value === g.status);
                return (
                  <TableRow
                    key={g.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => navigate({ to: "/accreditations/$gameId", params: { gameId: g.id } })}
                  >
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>{g.edition_year}</TableCell>
                    <TableCell>
                      {sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to="/games/$id/accreditations"
                            params={{ id: g.id }}
                          >
                            Accréditations en cours
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({ to: "/accreditations/$gameId", params: { gameId: g.id } });
                          }}
                        >
                          Configurer
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}