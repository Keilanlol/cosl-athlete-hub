import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/communication/")({
  component: () => (
    <PageStub
      title="Communication & Reporting"
      description="Tableaux de bord, exports, indicateurs de communication."
    />
  ),
});
