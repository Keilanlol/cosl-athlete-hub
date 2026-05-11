import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/delegation")({
  component: () => <PageStub title="Délégation" description="Composition officielle de la délégation." />,
});
