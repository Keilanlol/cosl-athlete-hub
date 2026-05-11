import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/lodging")({
  component: () => <PageStub title="Hébergement" description="Hôtels et rooming list." />,
});
