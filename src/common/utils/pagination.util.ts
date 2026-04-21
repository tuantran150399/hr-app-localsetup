/**
 * Wraps a TypeORM findAndCount result into a standard paginated response.
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function paginate<T>(
  [data, total]: [T[], number],
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** Returns skip (offset) value for a given page/limit. */
export function getSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
