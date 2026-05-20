import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  UserCog,
  UserRound,
  Trophy,
  BadgeCheck,
  Plane,
  MessageSquare,
  Settings,
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

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Vue d'ensemble",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Athlete Management",
    items: [
      { title: "Athlètes", url: "/athletes", icon: Users },
      { title: "Fédérations", url: "/federations", icon: Building2 },
      { title: "Clubs", url: "/clubs", icon: Shield },
      { title: "Encadrement", url: "/coaches", icon: UserCog },
    ],
  },
  {
    label: "Games & Competitions",
    items: [{ title: "Games", url: "/games", icon: Trophy }],
  },
  {
    label: "Accreditation",
    items: [{ title: "Accréditations", url: "/accreditations", icon: BadgeCheck }],
  },
  {
    label: "Logistics & Travel",
    items: [{ title: "Logistique", url: "/logistics", icon: Plane }],
  },
  {
    label: "Communication",
    items: [{ title: "Messages & Reporting", url: "/communication", icon: MessageSquare }],
  },
  {
    label: "Administration",
    items: [{ title: "Comptes COSL", url: "/admin/users", icon: Settings }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string) =>
    pathname === url || (url !== "/dashboard" && pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="bg-slate-800 text-slate-100">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#ED2939" }}
            />
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#003F87" }}
            />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight">COSLxBloobiz</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-slate-800 text-slate-300">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-slate-500">{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={
                          active
                            ? "bg-indigo-500 text-white hover:bg-indigo-500 hover:text-white"
                            : "text-slate-300 hover:bg-slate-700 hover:text-white"
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
