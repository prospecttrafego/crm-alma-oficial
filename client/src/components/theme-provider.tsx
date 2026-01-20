import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usersApi } from "@/lib/api/users";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isUpdating: boolean;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  isUpdating: false,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "convert-crm-theme",
  ...props
}: ThemeProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get initial theme: user preferences > localStorage > default
  const getInitialTheme = (): Theme => {
    const userPrefs = user?.preferences as { theme?: Theme } | undefined;
    if (userPrefs?.theme) {
      return userPrefs.theme;
    }
    const stored = localStorage.getItem(storageKey) as Theme;
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return defaultTheme;
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Update theme when user preferences change
  useEffect(() => {
    const userPrefs = user?.preferences as { theme?: Theme } | undefined;
    if (userPrefs?.theme) {
      setThemeState(userPrefs.theme);
    }
  }, [user?.preferences]);

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Mutation to save theme preference
  const updateThemeMutation = useMutation({
    mutationFn: async (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      if (user) {
        return usersApi.updateMe({ preferences: { theme: newTheme } });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    updateThemeMutation.mutate(newTheme);
  }, [updateThemeMutation]);

  const value = {
    theme,
    setTheme,
    isUpdating: updateThemeMutation.isPending,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
