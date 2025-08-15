import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { HandlerContext } from './../handlers.js';
import { RequestFilterSchema } from './schemas.js';

/**
 * Handle getting requests filtered by domain
 */
export async function handleGetRequestsByDomain(
  context: HandlerContext,
  filter: unknown
): Promise<object> {
  let validatedFilter;
  try {
    validatedFilter = RequestFilterSchema.parse(filter);
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${
        error instanceof Error ? error.message : 'Unknown validation error'
      }`
    );
  }
  const { url, domain } = validatedFilter as any;

  // Domain parameter is required for this endpoint
  if (!domain || (typeof domain === 'string' && domain.trim() === '')) {
    throw new McpError(ErrorCode.InvalidParams, 'Domain parameter is required');
  }

  const result = context.analysisResults.get(url);

  if (!result) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `No analysis found for URL: ${url}. Please run analyze_website_requests first.`
    );
  }

  const domainRequests = result.requests.filter((req: any) => {
    try {
      return new URL(req.url).hostname === domain;
    } catch {
      return false;
    }
  });

  const summary = {
    url: url,
    domain: domain,
    totalRequests: domainRequests.length,
    requests: domainRequests.map((req: any) => ({
      id: req.id,
      url: req.url,
      method: req.method,
      resourceType: req.resourceType,
      status: req.status,
      timestamp: req.timestamp,
    })),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(summary, null, 2),
      },
    ],
  };
}

/**
 * Handle getting full request details by ID
 */
export async function handleGetRequestDetails(
  context: HandlerContext,
  filter: unknown
): Promise<object> {
  let validatedFilter;
  try {
    validatedFilter = RequestFilterSchema.parse(filter);
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${
        error instanceof Error ? error.message : 'Unknown validation error'
      }`
    );
  }
  const { url, requestId } = validatedFilter as any;

  // requestId is required for this endpoint
  if (
    !requestId ||
    (typeof requestId === 'string' && requestId.trim() === '')
  ) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Request ID parameter is required'
    );
  }

  const result = context.analysisResults.get(url);

  if (!result) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `No analysis found for URL: ${url}. Please run analyze_website_requests first.`
    );
  }

  const request = result.requests.find((req: any) => req.id === requestId);

  if (!request) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `No request found with ID: ${requestId}`
    );
  }

  const details = {
    id: request.id,
    url: request.url,
    method: request.method,
    resourceType: request.resourceType,
    timestamp: request.timestamp,
    status: request.status,
    requestHeaders: request.headers,
    postData: request.postData,
    responseHeaders: request.responseHeaders,
    responseBody: request.responseBody,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(details, null, 2),
      },
    ],
  };
}
