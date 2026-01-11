import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usersApi } from "@/lib/api/users";

// Import translation files
import ptBR from "@/locales/pt-BR.json";
import en from "@/locales/en.json";

export type Language = "pt-BR" | "en";

type TranslationValue = string | Record<string, unknown>;
type Translations = Record<string, TranslationValue>;

const translations: Record<Language, Translations> = {
  "pt-BR": ptBR as Translations,
  "en": en as Translations,
};

const LANGUAGE_STORAGE_KEY = "crm_language";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isUpdating: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get initial language
  const getInitialLanguage = (): Language => {
    // Check user preferences first
    const userPrefs = user?.preferences as { language?: Language } | undefined;
    if (userPrefs?.language) {
      return userPrefs.language;
    }

    // Check localStorage
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "pt-BR" || stored === "en") {
      return stored;
    }

    // Default to pt-BR
    return "pt-BR";
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Update language when user changes
  useEffect(() => {
    const userPrefs = user?.preferences as { language?: Language } | undefined;
    if (userPrefs?.language) {
      setLanguageState(userPrefs.language);
    }
  }, [user?.preferences]);

  // Mutation to save language preference
  const updateLanguageMutation = useMutation({
    mutationFn: async (newLanguage: Language) => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
      if (user) {
        return usersApi.updateMe({ preferences: { language: newLanguage } });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
    updateLanguageMutation.mutate(newLanguage);
  }, [updateLanguageMutation]);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split(".");
    let value: unknown = translations[language];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to English, then to key itself
        let fallback: unknown = translations["en"];
        for (const fk of keys) {
          if (fallback && typeof fallback === "object" && fk in fallback) {
            fallback = (fallback as Record<string, unknown>)[fk];
          } else {
            return key; // Return key if not found
          }
        }
        value = fallback;
        break;
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    // Replace parameters
    if (params) {
      return Object.entries(params).reduce(
        (str, [paramKey, paramValue]) => str.replace(new RegExp(`{{${paramKey}}}`, "g"), String(paramValue)),
        value
      );
    }

    return value;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isUpdating: updateLanguageMutation.isPending }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}

// Re-export Language type and labels
export const languageLabels: Record<Language, string> = {
  "pt-BR": "Português (Brasil)",
  "en": "English",
};

export const languages: Language[] = ["pt-BR", "en"];
