import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/selections")({
  component: () => <PageStub title="Sélections" description="Sélection des athlètes pour ces Games." />,
});
