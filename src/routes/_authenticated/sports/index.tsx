import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/sports/")({
  component: SportsPage,
});

function SportsPage() {
  return (
    <PageStub
      title="Sports"
      description="Gestion des sports reconnus par le COSL."
    >
      Module à implémenter — scaffold uniquement.
    </PageStub>
  );
}