import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/games/$id/")({
  component: GameDetail,
});

function GameDetail() {
  const { id } = Route.useParams();
  return <PageStub title={`Games #${id}`} description="Sports activés, quotas, sélections." />;
}
