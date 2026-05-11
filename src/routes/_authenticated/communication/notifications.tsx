import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/communication/notifications")({
  component: () => (
    <PageStub title="Notifications" description="Historique des notifications automatiques." />
  ),
});
