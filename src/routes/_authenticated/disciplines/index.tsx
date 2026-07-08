import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/disciplines/")({
  beforeLoad: () => {
    throw redirect({ to: "/sports" });
  },
  component: () => null,
});