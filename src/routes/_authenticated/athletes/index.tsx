import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/athletes/")({
  component: () => (
    <PageStub title="Athlètes" description="Référentiel central des athlètes COSL." />
  ),
});
