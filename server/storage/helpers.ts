import { getSingleTenantOrganizationId } from "../tenant";

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Normalizes pagination params and returns `{ page, limit, offset }`.
 *
 * - `page` is clamped to 1+
 * - `limit` is clamped to 1..MAX_LIMIT
 * - `offset` is derived as `(page - 1) * limit`
 */
export function normalizePagination(
  params: PaginationParams,
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, params.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Normaliza telefone removendo todos os caracteres nao numericos
 * Exemplo: "+55 (11) 99999-9999" -> "5511999999999"
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, "");
  return normalized.length > 0 ? normalized : null;
}

/**
 * Returns the current tenant organization ID.
 *
 * This CRM runs in single-tenant mode per installation, so this resolves to `DEFAULT_ORGANIZATION_ID`.
 */
export async function getTenantOrganizationId(): Promise<number> {
  return getSingleTenantOrganizationId();
}
