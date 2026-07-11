import { z } from 'zod';
export const claimSchema = z.object({ quantity: z.number().int().positive() });
