import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/logistics/")({
  component: () => (
    <PageStub title="Logistique" description="Vue transverse voyages, hébergement, transport." />
  ),
});
