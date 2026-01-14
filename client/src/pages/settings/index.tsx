/**
 * Settings Page
 * Main settings page that aggregates all settings sections
 */

import { useTranslation } from "@/contexts/LanguageContext";
import { ProfileSection } from "./profile-section";
import { AppearanceSection } from "./appearance-section";
import { AccountSection } from "./account-section";
import { NotificationsSection } from "./notifications-section";
import { PipelineManagementSection } from "./pipelines";
import { EmailTemplatesSection } from "./templates";
import { IntegrationsSection } from "./channels";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground">{t("settings.profile.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileSection />
        <AppearanceSection />
        <NotificationsSection />
        <AccountSection />
        <PipelineManagementSection />
        <EmailTemplatesSection />
        <IntegrationsSection />
      </div>
    </div>
  );
}
