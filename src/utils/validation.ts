import { z } from 'zod';

const tag = z.string().trim().max(50);


export const snippetSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  language: z.string().trim().min(1).max(50),
  code: z.string().min(1).max(500_000),
  docs: z.string().max(500_000).optional().default(''),
  isPinned: z.boolean().optional().default(false),
  tags: z.array(tag).max(30).optional().default([])
});

export const pinSchema = z.object({ isPinned: z.boolean() });

const filter = z.array(z.string().trim().min(1).max(50)).max(30).default([]);

export const searchSchema = z.object({
  query: z.string().max(200).default(''),
  tags: filter,
  languages: filter
});

export type SnippetBody = z.infer<typeof snippetSchema>;
export type SearchBody = z.infer<typeof searchSchema>;
