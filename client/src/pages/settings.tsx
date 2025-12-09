import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { User, Bell, Palette, Shield, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

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
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold" data-testid="text-profile-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
                  {user?.email}
                </p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {user?.role || "sales"}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  defaultValue={user?.firstName || ""}
                  disabled
                  data-testid="input-settings-firstName"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  defaultValue={user?.lastName || ""}
                  disabled
                  data-testid="input-settings-lastName"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Toggle between light and dark mode
                </p>
              </div>
              <ThemeToggle />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="font-medium">Theme Options</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "light" ? "border-primary bg-accent" : "hover:bg-accent"
                  }`}
                  data-testid="button-theme-light"
                >
                  <div className="h-8 w-8 rounded-full bg-white border" />
                  <span className="text-sm">Light</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "dark" ? "border-primary bg-accent" : "hover:bg-accent"
                  }`}
                  data-testid="button-theme-dark"
                >
                  <div className="h-8 w-8 rounded-full bg-zinc-900 border" />
                  <span className="text-sm">Dark</span>
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "system" ? "border-primary bg-accent" : "hover:bg-accent"
                  }`}
                  data-testid="button-theme-system"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white to-zinc-900 border" />
                  <span className="text-sm">System</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email for new messages
                  </p>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Browser push notifications
                  </p>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Session</p>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account
                </p>
              </div>
              <a href="/api/logout">
                <Button variant="outline" data-testid="button-settings-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
