import { z } from "zod";

export const contactIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const deleteConfirmSchema = z.object({
  confirmDelete: z.boolean(),
});
