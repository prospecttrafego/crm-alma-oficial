import { lazy, Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider, useTranslation } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { setSentryUser } from "@/lib/sentry";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
// Eager imports for landing/auth pages (needed immediately)
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

// Lazy loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/dashboard"));
const PipelinePage = lazy(() => import("@/pages/pipeline"));
const InboxPage = lazy(() => import("@/pages/inbox"));
const ContactsPage = lazy(() => import("@/pages/contacts"));
const ActivitiesPage = lazy(() => import("@/pages/activities"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const AuditLogPage = lazy(() => import("@/pages/audit-log"));
const CalendarPage = lazy(() => import("@/pages/calendar"));

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <WebSocketProvider userId={user?.id} userName={user ? `${user.firstName} ${user.lastName}` : undefined}>
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col">
            <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger label={t("common.toggleSidebar")} data-testid="button-sidebar-toggle" />
              </div>
              <div className="flex items-center gap-2">
                <CommandPalette />
                <NotificationBell />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-hidden">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </WebSocketProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary">
          <span className="text-xl font-bold text-primary-foreground">A</span>
        </div>
        <Skeleton className="mx-auto h-4 w-24" />
      </div>
    </div>
  );
}

function PageLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <Skeleton className="mx-auto mb-4 h-8 w-8 rounded-full" />
        <Skeleton className="mx-auto h-4 w-32" />
      </div>
    </div>
  );
}

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    setSentryUser(user);
  }, [user]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={LoginPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <Suspense fallback={<PageLoadingFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/pipeline" component={PipelinePage} />
          <Route path="/pipeline/:pipelineId" component={PipelinePage} />
          <Route path="/inbox" component={InboxPage} />
          <Route path="/contacts" component={ContactsPage} />
          <Route path="/activities" component={ActivitiesPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/settings/*?" component={SettingsPage} />
          <Route path="/audit-log" component={AuditLogPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
