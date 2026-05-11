import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/")({
  component: () => (
    <PageStub title="Games" description="Événements multi-sports : JO, JPEE, EYOF, JOJ..." />
  ),
});
