import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Capped so a client cannot ask for the whole collection in one request.
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginate<T>(items: T[], total: number, { page, limit }: Pagination): Paginated<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { items, page, limit, total, totalPages, hasMore: page < totalPages };
}

export function skipFor({ page, limit }: Pagination): number {
  return (page - 1) * limit;
}
