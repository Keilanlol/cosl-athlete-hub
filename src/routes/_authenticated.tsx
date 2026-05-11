import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}
