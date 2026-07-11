import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const createDropSchema = z.object({ item: z.string().min(1), totalStock: z.number().int().positive(), liveAt: z.coerce.date(), price: z.number().int().positive(), maxPerUser: z.number().int().positive() });
export const claimSchema = z.object({ quantity: z.number().int().positive() });
