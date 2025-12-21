/**
 * Pagina de login e registro
 * Formulario de autenticacao com email/senha
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";

// Flag para habilitar/desabilitar registro (configuravel via env)
const ALLOW_REGISTRATION = import.meta.env.VITE_ALLOW_REGISTRATION === "true";

interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData extends LoginFormData {
  firstName: string;
  lastName: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  // Mutation para login
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t("auth.invalidCredentials"));
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalida cache do usuario para forcar reload
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: t("auth.loginSuccess"),
        description: t("auth.welcomeBack"),
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: t("auth.loginError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para registro
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t("auth.registerError"));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: t("auth.accountCreated"),
        description: t("auth.accountCreatedDescription"),
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: t("auth.registerError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegisterMode) {
      registerMutation.mutate(formData);
    } else {
      loginMutation.mutate({
        email: formData.email,
        password: formData.password,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <span className="text-3xl font-black tracking-tight">
              <span className="text-primary">Convert</span>
              <span className="text-muted-foreground">.CRM</span>
            </span>
          </div>
          <CardTitle className="text-2xl">
            {isRegisterMode ? t("auth.signUp") : t("auth.signIn")}
          </CardTitle>
          <CardDescription>
            {isRegisterMode
              ? t("auth.registerSubtitle")
              : t("auth.loginSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("settings.profile.firstName")}</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("settings.profile.lastName")}</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegisterMode ? t("auth.signUp") : t("auth.signIn")}
            </Button>
          </form>

          {ALLOW_REGISTRATION && (
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">
                {isRegisterMode ? t("auth.hasAccount") : t("auth.noAccount")}
              </span>{" "}
              <Button
                variant="link"
                className="px-0"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
              >
                {isRegisterMode ? t("auth.signIn") : t("auth.createAccount")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
