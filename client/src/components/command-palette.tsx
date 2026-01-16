import { useEffect, useState, useCallback, useMemo } from "react";
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
  MessageSquare,
  Clock,
  X,
  Loader2,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { searchApi, type GlobalSearchResponse } from "@/lib/api/search";

const RECENT_SEARCHES_KEY = "command-palette-recent-searches";
const MAX_RECENT_SEARCHES = 5;

interface RecentSearch {
  query: string;
  timestamp: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function getRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as RecentSearch[];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string): void {
  try {
    const searches = getRecentSearches();
    // Remove duplicate if exists
    const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase());
    // Add new search at the beginning
    const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const debouncedQuery = useDebounce(searchQuery, 300);

  const navigationItems = useMemo(
    () => [
      { key: "dashboard", name: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
      { key: "inbox", name: t("nav.inbox"), href: "/inbox", icon: Inbox },
      { key: "pipeline", name: t("nav.pipeline"), href: "/pipeline", icon: Kanban },
      { key: "contacts", name: t("nav.contacts"), href: "/contacts", icon: Users },
      { key: "activities", name: t("nav.activities"), href: "/activities", icon: Activity },
      { key: "settings", name: t("nav.settings"), href: "/settings", icon: Settings },
    ],
    [t]
  );

  const searchLabel = `${t("common.search")}...`;

  // Load recent searches when dialog opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      try {
        const results = await searchApi.search({ q: debouncedQuery, limit: 5 });
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery]);

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

  const runCommand = useCallback(
    (command: () => void, query?: string) => {
      if (query) {
        addRecentSearch(query);
      }
      setOpen(false);
      setSearchQuery("");
      setSearchResults(null);
      command();
    },
    []
  );

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const hasSearchResults =
    searchResults &&
    (searchResults.contacts.length > 0 ||
      searchResults.deals.length > 0 ||
      searchResults.conversations.length > 0);

  const showRecentSearches = !searchQuery && recentSearches.length > 0;
  const showSearchHint = !searchQuery && !showRecentSearches;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        data-testid="button-command-palette"
        aria-label={t("a11y.openCommandPalette")}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{searchLabel}</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("commandPalette.placeholder")}
          data-testid="input-command-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {/* Searching indicator */}
          {isSearching && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("commandPalette.searching")}</span>
            </div>
          )}

          {/* No search results */}
          {!isSearching && searchQuery.length >= 2 && !hasSearchResults && (
            <CommandEmpty>
              {t("commandPalette.noSearchResults")} "{searchQuery}"
            </CommandEmpty>
          )}

          {/* Search hint */}
          {showSearchHint && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("commandPalette.typeToSearch")}
            </div>
          )}

          {/* Recent searches */}
          {showRecentSearches && (
            <CommandGroup heading={t("commandPalette.recentSearches")}>
              {recentSearches.map((recent) => (
                <CommandItem
                  key={recent.timestamp}
                  onSelect={() => setSearchQuery(recent.query)}
                  data-testid={`recent-search-${recent.query}`}
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{recent.query}</span>
                </CommandItem>
              ))}
              <CommandItem
                onSelect={handleClearRecent}
                className="text-muted-foreground"
                data-testid="clear-recent-searches"
              >
                <X className="mr-2 h-4 w-4" />
                <span>{t("commandPalette.clearRecent")}</span>
              </CommandItem>
            </CommandGroup>
          )}

          {/* Search results - Contacts */}
          {!isSearching && searchResults && searchResults.contacts.length > 0 && (
            <CommandGroup heading={t("commandPalette.contacts")}>
              {searchResults.contacts.map((contact) => (
                <CommandItem
                  key={`contact-${contact.id}`}
                  onSelect={() =>
                    runCommand(() => setLocation(contact.href), searchQuery)
                  }
                  data-testid={`search-result-contact-${contact.id}`}
                >
                  <Users className="mr-2 h-4 w-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span>{contact.title}</span>
                    {contact.subtitle && (
                      <span className="text-xs text-muted-foreground">{contact.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Search results - Deals */}
          {!isSearching && searchResults && searchResults.deals.length > 0 && (
            <CommandGroup heading={t("commandPalette.deals")}>
              {searchResults.deals.map((deal) => (
                <CommandItem
                  key={`deal-${deal.id}`}
                  onSelect={() =>
                    runCommand(() => setLocation(deal.href), searchQuery)
                  }
                  data-testid={`search-result-deal-${deal.id}`}
                >
                  <Kanban className="mr-2 h-4 w-4 text-green-500" />
                  <div className="flex flex-col">
                    <span>{deal.title}</span>
                    {deal.subtitle && (
                      <span className="text-xs text-muted-foreground">{deal.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Search results - Conversations */}
          {!isSearching && searchResults && searchResults.conversations.length > 0 && (
            <CommandGroup heading={t("commandPalette.conversations")}>
              {searchResults.conversations.map((conv) => (
                <CommandItem
                  key={`conv-${conv.id}`}
                  onSelect={() =>
                    runCommand(() => setLocation(conv.href), searchQuery)
                  }
                  data-testid={`search-result-conversation-${conv.id}`}
                >
                  <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="flex flex-col">
                    <span>{conv.title}</span>
                    {conv.subtitle && (
                      <span className="text-xs text-muted-foreground">{conv.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Contextual action: Create deal for contact */}
          {!isSearching && searchResults && searchResults.contacts.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("commandPalette.quickActions")}>
                {searchResults.contacts.slice(0, 2).map((contact) => (
                  <CommandItem
                    key={`action-deal-${contact.id}`}
                    onSelect={() =>
                      runCommand(
                        () => setLocation(`/pipeline?new=deal&contactId=${contact.id}`),
                        searchQuery
                      )
                    }
                    data-testid={`action-create-deal-${contact.id}`}
                  >
                    <Kanban className="mr-2 h-4 w-4" />
                    <span>
                      {t("commandPalette.createDealFor")} {contact.title}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Navigation - show when no search or search is short */}
          {!isSearching && !hasSearchResults && (
            <>
              {searchQuery.length > 0 && <CommandSeparator />}
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
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
