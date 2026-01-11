/**
 * Hook de autenticacao
 * Verifica se o usuario esta autenticado e retorna seus dados
 */
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
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
