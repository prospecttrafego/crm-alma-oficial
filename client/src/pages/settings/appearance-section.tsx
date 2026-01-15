/**
 * Appearance Settings Section
 * Theme selection and visual preferences
 */

import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Palette } from "lucide-react";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.appearance.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.appearance.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t("settings.appearance.theme")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.appearance.subtitle")}
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="font-medium">{t("settings.appearance.theme")}</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                theme === "light" ? "border-primary bg-accent" : "hover-elevate"
              }`}
              data-testid="button-theme-light"
            >
              <div className="h-8 w-8 rounded-full bg-white border" />
              <span className="text-sm">{t("settings.appearance.light")}</span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                theme === "dark" ? "border-primary bg-accent" : "hover-elevate"
              }`}
              data-testid="button-theme-dark"
            >
              <div className="h-8 w-8 rounded-full bg-zinc-900 border" />
              <span className="text-sm">{t("settings.appearance.dark")}</span>
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                theme === "system" ? "border-primary bg-accent" : "hover-elevate"
              }`}
              data-testid="button-theme-system"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white to-zinc-900 border" />
              <span className="text-sm">{t("settings.appearance.system")}</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
