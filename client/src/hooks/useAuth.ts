/**
 * Hook de autenticacao
 * Verifica se o usuario esta autenticado e retorna seus dados
 */
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { ApiRequestError } from "@/lib/api";
import { usersApi } from "@/lib/api/users";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        return await usersApi.me();
      } catch (err) {
        if (err instanceof ApiRequestError && err.isUnauthorized()) {
          return null;
        }
        throw err;
      }
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
