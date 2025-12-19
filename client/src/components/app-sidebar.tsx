import { Link, useLocation } from "wouter";
import {
  Inbox,
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  Activity,
  Settings,
  LogOut,
  Shield,
  BarChart3,
  Calendar,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  const mainNavItems = [
    {
      title: t("nav.dashboard"),
      url: "/",
      icon: LayoutDashboard,
      key: "dashboard",
    },
    {
      title: t("nav.inbox"),
      url: "/inbox",
      icon: Inbox,
      key: "inbox",
    },
    {
      title: t("nav.pipeline"),
      url: "/pipeline",
      icon: Kanban,
      key: "pipeline",
    },
  ];

  const managementItems = [
    {
      title: t("nav.contacts"),
      url: "/contacts",
      icon: Users,
      key: "contacts",
    },
    {
      title: t("nav.companies"),
      url: "/companies",
      icon: Building2,
      key: "companies",
    },
    {
      title: t("nav.activities"),
      url: "/activities",
      icon: Activity,
      key: "activities",
    },
    {
      title: t("nav.calendar"),
      url: "/calendar",
      icon: Calendar,
      key: "calendar",
    },
    {
      title: t("nav.reports"),
      url: "/reports",
      icon: BarChart3,
      key: "reports",
    },
  ];

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Alma" className="h-10 w-10 rounded-md object-cover" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Digital Agency CRM</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.key}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.management")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.key}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              tooltip={t("nav.settings")}
            >
              <Link href="/settings" data-testid="link-nav-settings">
                <Settings className="h-4 w-4" />
                <span>{t("nav.settings")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user?.role === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/audit-log"}
                tooltip="Audit Log"
              >
                <Link href="/audit-log" data-testid="link-nav-audit-log">
                  <Shield className="h-4 w-4" />
                  <span>Audit Log</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        <SidebarSeparator />

        <div className="p-2">
          <div className="flex items-center gap-3 rounded-md p-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium" data-testid="text-user-name">
                {user?.firstName || user?.email?.split("@")[0] || "User"}
              </span>
              <span className="truncate text-xs text-muted-foreground" data-testid="text-user-email">
                {user?.email || ""}
              </span>
            </div>
            <a href="/api/logout" data-testid="button-logout">
              <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
