import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type Language = 'pt-BR' | 'en';

const LANGUAGE_STORAGE_KEY = 'crm_language';

const languageLabels: Record<Language, string> = {
  'pt-BR': 'Português (Brasil)',
  'en': 'English',
};

export function useLanguage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Priority: user.preferences.language > localStorage > 'pt-BR'
  const getCurrentLanguage = (): Language => {
    // Check user preferences first
    const userPrefs = user?.preferences as { language?: Language } | undefined;
    if (userPrefs?.language) {
      return userPrefs.language;
    }

    // Check localStorage
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en') {
      return stored;
    }

    // Default to pt-BR
    return 'pt-BR';
  };

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: Language) => {
      // Always save to localStorage for immediate access
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

      // If user is logged in, save to backend
      if (user) {
        const response = await apiRequest("PATCH", "/api/users/me", {
          preferences: { language },
        });
        return response.json();
      }
      return null;
    },
    onSuccess: (_, language) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: language === 'pt-BR'
          ? 'Idioma alterado para Português'
          : 'Language changed to English',
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao alterar idioma',
        variant: 'destructive',
      });
    },
  });

  const setLanguage = (language: Language) => {
    updateLanguageMutation.mutate(language);
  };

  return {
    language: getCurrentLanguage(),
    setLanguage,
    isUpdating: updateLanguageMutation.isPending,
    languageLabels,
    languages: ['pt-BR', 'en'] as Language[],
  };
}
