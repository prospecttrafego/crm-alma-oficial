import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Query function factory with configurable 401 handling.
 *
 * @deprecated LEGACY PATTERN - Prefer using explicit queryFn from API modules.
 *
 * This function constructs URLs from queryKey.join("/"), which is fragile:
 * - Objects or non-string primitives in queryKey will break
 * - No type safety or Zod validation
 *
 * Preferred pattern:
 * ```typescript
 * import { notificationsApi } from "@/lib/api";
 *
 * useQuery({
 *   queryKey: ["/api/notifications"],
 *   queryFn: notificationsApi.list, // Uses ApiClient with Zod validation
 * });
 * ```
 *
 * For new code, always use domain-specific API modules from `@/lib/api/`.
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch {
        errorData = {
          error: {
            code: 'UNKNOWN_ERROR',
            message: res.statusText || 'Erro desconhecido',
          }
        };
      }

      if (errorData.error) {
        throw new ApiRequestError(errorData.error, res.status);
      }

      throw new ApiRequestError(
        {
          code: 'UNKNOWN_ERROR',
          message: errorData.message || res.statusText || 'Erro desconhecido',
        },
        res.status
      );
    }

    const json = await res.json();

    // Extract data from ApiResponse wrapper if present
    if (json && typeof json === 'object' && 'success' in json && json.data !== undefined) {
      return json.data;
    }

    return json;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - reduces flicker from frequent invalidations
      gcTime: 30 * 60 * 1000, // 30 minutes - keeps data in cache longer
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
