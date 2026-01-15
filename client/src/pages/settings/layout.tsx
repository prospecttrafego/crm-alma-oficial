/**
 * Settings Layout
 * Layout component with sidebar navigation for settings pages
 */

import { Link, useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  User,
  Bell,
  Kanban,
  FileText,
  Plug,
  ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/settings/profile", labelKey: "settings.nav.profile", icon: User },
  { href: "/settings/notifications", labelKey: "settings.nav.notifications", icon: Bell },
  { href: "/settings/pipelines", labelKey: "settings.nav.pipelines", icon: Kanban },
  { href: "/settings/templates", labelKey: "settings.nav.templates", icon: FileText },
  { href: "/settings/integrations", labelKey: "settings.nav.integrations", icon: Plug },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="hidden w-56 shrink-0 border-r md:block">
          <ScrollArea className="h-full py-4">
            <div className="space-y-1 px-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      data-testid={`nav-${item.href.split("/").pop()}`}
                    >
                      <Icon className="h-4 w-4" />
                      {t(item.labelKey)}
                      {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                    </span>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        </nav>

        {/* Mobile Navigation */}
        <div className="border-b px-4 py-2 md:hidden">
          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={cn(
                        "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
