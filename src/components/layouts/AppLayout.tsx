import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function AppLayout({ children }: { children: ReactNode }) {
  const { full_name, username, role, signOut } = useAuth();
  const display = full_name || username || "Utilisateur COSL";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#FAFAFA]">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-[#E8E8E8] bg-card px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="text-xs uppercase tracking-[0.15em] font-semibold text-[#717171]">
                Games Management Platform
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-[#1A1A1A]">{display}</div>
                {role && (
                  <div className="text-xs text-[#717171] capitalize">
                    {role.replace("_", " ")}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="gap-2 text-[#717171] hover:text-primary hover:bg-[#F5E6E9]"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

