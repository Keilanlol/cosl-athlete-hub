import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/transport")({
  component: () => <PageStub title="Transports locaux" description="Navettes, bus, transferts." />,
});
