import { z } from 'zod';

export const AnalysisOptionsSchema = z.object({
  url: z.string().url('URL must be a valid URL with http:// or https://'),
  waitTime: z.number().min(0).max(10000).optional(),
  includeImages: z.boolean().optional(),
  quickMode: z.boolean().optional(),
});

export const RequestFilterSchema = z.object({
  url: z.string().url('URL must be a valid URL with http:// or https://'),
  domain: z.string().optional(),
  requestId: z.string().optional(),
});

export const UrlSchema = z
  .string()
  .url('URL must be a valid URL with http:// or https://');

export const ExtractHtmlElementsSchema = z.object({
  url: z.string().url('URL must be a valid URL with http:// or https://'),
  filterType: z.enum(['text', 'image', 'link', 'script']),
});

export const FetchOptionsSchema = z.object({
  url: z.string().url('URL must be a valid URL with http:// or https://'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
    .optional()
    .default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
});
