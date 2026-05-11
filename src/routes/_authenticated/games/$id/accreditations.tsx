import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/accreditations")({
  component: () => <PageStub title="Accréditations" description="Accréditations de ces Games." />,
});
