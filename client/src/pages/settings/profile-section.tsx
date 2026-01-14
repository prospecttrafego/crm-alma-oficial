/**
 * Profile Settings Section
 * Displays user profile information
 */

import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "@/components/avatar-upload";
import { User } from "lucide-react";

export function ProfileSection() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const roleKey = user?.role ? `roles.${user.role}` : "roles.unknown";
  const roleLabel = t(roleKey);
  const displayRole = roleLabel === roleKey ? (user?.role || t("roles.unknown")) : roleLabel;

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.profile.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.profile.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <AvatarUpload
            currentImageUrl={user?.profileImageUrl}
            fallback={getInitials()}
            size="md"
          />
          <div>
            <p className="font-semibold" data-testid="text-profile-name">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
              {user?.email}
            </p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {displayRole}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="firstName">{t("settings.profile.firstName")}</Label>
            <Input
              id="firstName"
              defaultValue={user?.firstName || ""}
              disabled
              data-testid="input-settings-firstName"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastName">{t("settings.profile.lastName")}</Label>
            <Input
              id="lastName"
              defaultValue={user?.lastName || ""}
              disabled
              data-testid="input-settings-lastName"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("settings.profile.email")}</Label>
            <Input
              id="email"
              type="email"
              defaultValue={user?.email || ""}
              disabled
              data-testid="input-settings-email"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
