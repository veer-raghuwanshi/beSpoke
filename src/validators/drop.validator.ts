import { z } from 'zod';

export const createDropSchema = z.object({
  item: z.string().min(1),
  totalStock: z.number().int().positive(),
  liveAt: z.coerce.date(),
  price: z.number().int().positive(),
  maxPerUser: z.number().int().positive(),
});
