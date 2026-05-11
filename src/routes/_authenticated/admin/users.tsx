import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => (
    <PageStub title="Comptes COSL" description="Gestion des utilisateurs et rôles." />
  ),
});
