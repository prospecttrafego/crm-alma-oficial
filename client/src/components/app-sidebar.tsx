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
  ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { Pipeline } from "@shared/schema";

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Fetch pipelines for submenu
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
    enabled: !!user,
  });

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

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={isCollapsed ? "p-2" : "p-4"}>
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          {isCollapsed ? (
            <span className="text-xl font-black text-primary">C</span>
          ) : (
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight">
                <span className="text-primary">Convert</span>
                <span className="text-muted-foreground">.CRM</span>
              </span>
              <span className="text-xs text-muted-foreground">{t("app.brandSubtitle")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.main")}</SidebarGroupLabel>
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

              {/* Pipeline with submenu */}
              <Collapsible
                asChild
                defaultOpen={location.startsWith("/pipeline")}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={t("nav.pipeline")}
                      isActive={location.startsWith("/pipeline")}
                    >
                      <Kanban className="h-4 w-4" />
                      <span>{t("nav.pipeline")}</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {pipelines.map((pipeline) => (
                        <SidebarMenuSubItem key={pipeline.id}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === `/pipeline/${pipeline.id}`}
                          >
                            <Link href={`/pipeline/${pipeline.id}`}>
                              <span>{pipeline.name}</span>
                              {pipeline.isDefault && (
                                <span className="ml-auto text-[10px] text-muted-foreground">
                                  {t("settings.pipelines.default")}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
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
                tooltip={t("nav.auditLog")}
              >
                <Link href="/audit-log" data-testid="link-nav-audit-log">
                  <Shield className="h-4 w-4" />
                  <span>{t("nav.auditLog")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        <SidebarSeparator />

        <div className="p-2">
          <div className={`flex items-center rounded-md ${isCollapsed ? "justify-center p-1" : "gap-3 p-2"}`}>
            <Avatar className={isCollapsed ? "h-7 w-7" : "h-8 w-8"}>
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium" data-testid="text-user-name">
                    {user?.firstName || user?.email?.split("@")[0] || t("common.user")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" data-testid="text-user-email">
                    {user?.email || ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={t("settings.account.signOut")}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
