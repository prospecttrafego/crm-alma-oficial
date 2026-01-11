import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

/**
 * Helper to throw structured errors from non-ok responses
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      // If response is not JSON, create a generic error
      errorData = {
        error: {
          code: 'UNKNOWN_ERROR',
          message: res.statusText || 'Erro desconhecido',
        }
      };
    }

    // Throw structured error if available
    if (errorData.error) {
      throw new ApiRequestError(errorData.error, res.status);
    }

    // Fallback for legacy responses
    throw new ApiRequestError(
      {
        code: 'UNKNOWN_ERROR',
        message: errorData.message || res.statusText || 'Erro desconhecido',
      },
      res.status
    );
  }
}

/**
 * Generic API request function for mutations
 * @deprecated Use the new typed API client from @/lib/api instead
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Query function factory with configurable 401 handling
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
