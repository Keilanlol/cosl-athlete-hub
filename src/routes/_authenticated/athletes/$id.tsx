import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/athletes/$id")({
  component: AthleteDetail,
});

function AthleteDetail() {
  const { id } = Route.useParams();
  return <PageStub title={`Fiche athlète #${id}`} description="Détails, documents, KYC, relations." />;
}
