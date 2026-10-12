import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/app")({
  beforeLoad: requireAuth,
  component: AppShell,
});

function AppShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
