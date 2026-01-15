/**
 * Settings Page Index
 * Main entry point that renders the settings layout with nested routes
 */

import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { SettingsLayout } from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineManagementSection } from "./pipelines";
import { EmailTemplatesSection } from "./templates";

// Lazy loaded pages for code splitting
const ProfilePage = lazy(() => import("./profile"));
const NotificationsPage = lazy(() => import("./notifications"));
const IntegrationsPage = lazy(() => import("./integrations"));
const WhatsAppPage = lazy(() => import("./integrations/whatsapp"));
const EmailPage = lazy(() => import("./integrations/email"));
const CalendarPage = lazy(() => import("./integrations/calendar"));

function SettingsLoadingFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <SettingsLayout>
      <Suspense fallback={<SettingsLoadingFallback />}>
        <Switch>
          <Route path="/settings/profile" component={ProfilePage} />
          <Route path="/settings/notifications" component={NotificationsPage} />
          <Route path="/settings/pipelines">
            <PipelineManagementSection />
          </Route>
          <Route path="/settings/templates">
            <EmailTemplatesSection />
          </Route>
          <Route path="/settings/integrations" component={IntegrationsPage} />
          <Route path="/settings/integrations/whatsapp" component={WhatsAppPage} />
          <Route path="/settings/integrations/email" component={EmailPage} />
          <Route path="/settings/integrations/calendar" component={CalendarPage} />
          {/* Default redirect to profile */}
          <Route path="/settings">
            <Redirect to="/settings/profile" />
          </Route>
        </Switch>
      </Suspense>
    </SettingsLayout>
  );
}
