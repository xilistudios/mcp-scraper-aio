import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { HandlerContext } from './../handlers.js';
import { ExtractHtmlElementsSchema } from './schemas.js';
import { InvalidUrlError } from '../errors.js';

/**
 * Handle extraction of HTML elements from a URL
 */
export async function handleExtractHtmlElements(
  context: HandlerContext,
  params: unknown
): Promise<object> {
  let validatedParams;
  try {
    validatedParams = ExtractHtmlElementsSchema.parse(params);
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${
        error instanceof Error ? error.message : 'Unknown validation error'
      }`
    );
  }

  const { url, filterType } = validatedParams as any;

  context.logger.info(
    `[Extraction] Extracting elements from ${url} with filter '${filterType}'`
  );
  context.logger.debug(
    `[Extraction] Params validated: ${JSON.stringify({ url, filterType })}`
  );

  try {
    const elements = await context.analyzer.extractHtmlElements(
      url,
      filterType
    );
    context.logger.info(
      `[Extraction] Extracted ${
        Array.isArray(elements) ? elements.length : 0
      } elements from ${url}`
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(elements, null, 2),
        },
      ],
    };
  } catch (error) {
    context.logger.error(
      `[Extraction] Failed to extract elements: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    if (error instanceof InvalidUrlError) {
      throw new McpError(ErrorCode.InvalidParams, error.message);
    } else {
      throw new McpError(ErrorCode.InternalError, 'Unknown extraction error');
    }
  }
}
