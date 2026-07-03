import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/disciplines/")({
  component: DisciplinesPage,
});

function DisciplinesPage() {
  return (
    <PageStub
      title="Disciplines"
      description="Gestion des disciplines rattachées aux sports."
    >
      Module à implémenter — scaffold uniquement.
    </PageStub>
  );
}