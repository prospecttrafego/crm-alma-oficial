import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Inbox,
  LayoutDashboard,
  Users,
  Kanban,
  Activity,
  Settings,
  Search,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const navigationItems = [
    { key: "dashboard", name: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { key: "inbox", name: t("nav.inbox"), href: "/inbox", icon: Inbox },
    { key: "pipeline", name: t("nav.pipeline"), href: "/pipeline", icon: Kanban },
    { key: "contacts", name: t("nav.contacts"), href: "/contacts", icon: Users },
    { key: "activities", name: t("nav.activities"), href: "/activities", icon: Activity },
    { key: "settings", name: t("nav.settings"), href: "/settings", icon: Settings },
  ];

  const searchLabel = `${t("common.search")}...`;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        data-testid="button-command-palette"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{searchLabel}</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("commandPalette.placeholder")} data-testid="input-command-search" />
        <CommandList>
          <CommandEmpty>{t("common.noResults")}</CommandEmpty>
          <CommandGroup heading={t("commandPalette.navigation")}>
            {navigationItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => setLocation(item.href))}
                data-testid={`command-nav-${item.key}`}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t("commandPalette.quickActions")}>
            <CommandItem
              onSelect={() => runCommand(() => setLocation("/pipeline?new=deal"))}
              data-testid="command-new-deal"
            >
              <Kanban className="mr-2 h-4 w-4" />
              <span>{t("commandPalette.newDeal")}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setLocation("/contacts?new=contact"))}
              data-testid="command-new-contact"
            >
              <Users className="mr-2 h-4 w-4" />
              <span>{t("commandPalette.newContact")}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
