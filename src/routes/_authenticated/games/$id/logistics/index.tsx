import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/")({
  component: () => <PageStub title="Logistique du Games" description="Plan de voyage global." />,
});
