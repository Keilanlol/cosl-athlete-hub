import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/federations/")({
  component: () => (
    <PageStub title="Fédérations" description="Fédérations sportives nationales." />
  ),
});
