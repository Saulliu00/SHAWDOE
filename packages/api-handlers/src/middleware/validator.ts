import { z } from 'zod';

export const processCommentsSchema = z.object({
  comments: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1).max(2000),
        author: z.string().optional(),
        timestamp: z.string().optional(),
      }),
    )
    .min(1)
    .max(25),
  platform: z.enum(['youtube', 'twitch']),
  context: z
    .object({
      videoId: z.string().optional(),
      channelName: z.string().optional(),
    })
    .optional(),
  clientId: z.string().uuid(),
});

export type ValidatedProcessRequest = z.infer<typeof processCommentsSchema>;

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return { success: false, error: messages.join('; ') };
}
