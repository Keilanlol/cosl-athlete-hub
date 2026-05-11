import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/clubs/")({
  component: () => <PageStub title="Clubs" description="Clubs affiliés aux fédérations." />,
});
