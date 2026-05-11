import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/communication/messages")({
  component: () => (
    <PageStub title="Messages" description="Envois ciblés e-mail / SMS." />
  ),
});
