import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCog,
  UserRound,
  Trophy,
  BadgeCheck,
  Plane,
  MessageSquare,
  Settings,
  Star,
  Handshake,
  Volleyball,
  CalendarDays,
  Tag,
  ShieldCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; module?: string };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Vue d'ensemble",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Gestion de fédérations & effectifs",
    items: [
      { title: "Personnes", url: "/persons", icon: Users, module: "persons" },
      { title: "Athlètes", url: "/athletes", icon: Users, module: "athletes" },
      { title: "Fédérations", url: "/federations", icon: Building2, module: "federations" },
      { title: "Encadrement", url: "/coaches", icon: UserCog, module: "persons" },
      { title: "Membres", url: "/members", icon: UserRound, module: "persons" },
    ],
  },
  {
    label: "Games Management",
    items: [
      { title: "Games", url: "/games", icon: Trophy, module: "games" },
      { title: "Sports", url: "/sports", icon: Volleyball, module: "games" },
      { title: "Logistique", url: "/logistics", icon: Plane, module: "logistics" },
      { title: "Accréditations", url: "/accreditations", icon: BadgeCheck, module: "accreditations" },
    ],
  },
  {
    label: "Events Management",
    items: [
      { title: "Events", url: "/events", icon: CalendarDays, module: "events" },
      { title: "Sponsors", url: "/sponsors", icon: Star, module: "games" },
      { title: "Partenaires", url: "/partners", icon: Handshake, module: "games" },
    ],
  },
  {
    label: "Communication",
    items: [{ title: "Messages & Reporting", url: "/communication", icon: MessageSquare, module: "communication" }],
  },
  {
    label: "Administration",
    items: [
      { title: "Types & Rôles", url: "/admin/types-roles", icon: Tag, module: "admin" },
      { title: "Rôles & Permissions", url: "/admin/roles-permissions", icon: ShieldCheck, module: "admin" },
      { title: "Comptes COSL", url: "/admin/users", icon: Settings, module: "admin" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { canRead } = usePermissions();

  const isActive = (url: string) =>
    pathname === url || (url !== "/dashboard" && pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="bg-[#1A1A1A] text-[#F5F5F5] border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3 px-2 py-3">
          <img src="/logo-cosl.png" alt="COSL" className="h-9 w-auto shrink-0" />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-white font-bold text-sm">COSL</p>
              <p className="text-[#A0A0A0] text-[11px]">Bloobiz Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-[#1A1A1A] text-[#C0C0C0]">
        {groups.map((group) => {
          // Filtrer les items selon les permissions (Dashboard toujours visible)
          const visibleItems = group.items.filter(
            (item) => !item.module || canRead(item.module),
          );
          if (visibleItems.length === 0) return null;

          return (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[#717171] text-[10px] font-semibold tracking-[0.12em] uppercase">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={
                          active
                            ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium"
                            : "text-[#C0C0C0] hover:bg-[#2A2A2A] hover:text-white"
                        }
                      >
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
