import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/events/")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <PageStub
      title="Events"
      description="Gestion des événements sportifs et compétitions hors Games."
    >
      Module à implémenter — scaffold uniquement.
    </PageStub>
  );
}