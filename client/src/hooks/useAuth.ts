/**
 * Hook de autenticacao
 * Verifica se o usuario esta autenticado e retorna seus dados
 */
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      // Se nao autenticado, retorna null em vez de lancar erro
      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Erro ao verificar autenticacao");
      }

      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
