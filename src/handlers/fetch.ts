import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { HandlerContext } from './../handlers.js';
import { FetchOptionsSchema } from './schemas.js';

/**
 * Handle direct HTTP fetch requests (server-side)
 */
export async function handleFetch(
  context: HandlerContext,
  options: unknown
): Promise<object> {
  let validatedOptions;
  try {
    validatedOptions = FetchOptionsSchema.parse(options);
  } catch (error) {
    context.logger.error(
      `[Fetch] Invalid parameters: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${
        error instanceof Error ? error.message : 'Unknown validation error'
      }`
    );
  }

  const { url, method = 'GET', headers, body } = validatedOptions as any;

  context.logger.info(`[Fetch] Executing ${method} ${url}`);
  context.logger.debug(
    `[Fetch] Options: ${JSON.stringify({ method, headers, hasBody: !!body })}`
  );

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    } as any);

    // Collect headers into plain object
    const headerObj: Record<string, string> = {};
    try {
      if (typeof response.headers?.forEach === 'function') {
        response.headers.forEach((value: string, key: string) => {
          headerObj[key] = value;
        });
      } else if (
        response.headers &&
        typeof (response.headers as any).entries === 'function'
      ) {
        for (const [key, value] of (response.headers as any).entries()) {
          headerObj[key] = value;
        }
      }
    } catch (err) {
      context.logger.debug(
        `[Fetch] Failed to enumerate headers: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    const responseBody = await response.text();

    const resultPayload = {
      status: response.status,
      statusText: response.statusText,
      headers: headerObj,
      body: responseBody,
    };

    // Log non-OK responses but do not throw
    if (!response.ok) {
      context.logger.warn(
        `[Fetch] Non-OK response for ${url}: ${response.status} ${response.statusText}`
      );
    } else {
      context.logger.info(
        `[Fetch] Successful response for ${url}: ${response.status}`
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resultPayload, null, 2),
        },
      ],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    context.logger.error(`[Fetch] Network error for ${url}: ${msg}`);
    throw new McpError(ErrorCode.InternalError, `Network error: ${msg}`);
  }
}
