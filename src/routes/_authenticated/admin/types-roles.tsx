import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/admin/types-roles")({
  component: TypesRolesPage,
});

function TypesRolesPage() {
  return (
    <PageStub
      title="Types & Rôles"
      description="Configuration des types et rôles utilisés dans l'application."
    >
      Module à implémenter — scaffold uniquement.
    </PageStub>
  );
}