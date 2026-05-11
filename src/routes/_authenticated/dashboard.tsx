import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <PageStub
      title="Dashboard"
      description="Vue d'accueil — KPI Games, athlètes, accréditations, logistique."
    />
  ),
});
