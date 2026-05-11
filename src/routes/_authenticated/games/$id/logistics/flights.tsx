import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/flights")({
  component: () => <PageStub title="Vols" description="Vols internationaux." />,
});
