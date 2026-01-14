/**
 * Account Settings Section
 * Language selection and session management
 */

import { useTranslation, languageLabels, languages } from "@/contexts/LanguageContext";
import { authApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Languages, LogOut } from "lucide-react";

export function AccountSection() {
  const { language, setLanguage, t, isUpdating: isLanguageUpdating } = useTranslation();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.account.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.account.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("settings.account.language")}</p>
              <p className="text-sm text-muted-foreground">
                {t("settings.account.languageDescription")}
              </p>
            </div>
          </div>
          <Select
            value={language}
            onValueChange={(value) => setLanguage(value as "pt-BR" | "en")}
            disabled={isLanguageUpdating}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-language">
              <SelectValue placeholder={t("settings.account.languagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {languageLabels[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t("settings.account.session")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.account.sessionDescription")}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-settings-logout">
            <LogOut className="mr-2 h-4 w-4" />
            {t("settings.account.signOut")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
