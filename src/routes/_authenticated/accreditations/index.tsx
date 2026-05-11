import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/accreditations/")({
  component: () => (
    <PageStub title="Accréditations" description="Vue globale toutes Games confondus." />
  ),
});
