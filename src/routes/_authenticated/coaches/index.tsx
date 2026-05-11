import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/coaches/")({
  component: () => (
    <PageStub title="Encadrement" description="Entraîneurs, managers, staff médical." />
  ),
});
