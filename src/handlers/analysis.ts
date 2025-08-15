import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { HandlerContext } from './../handlers.js';
import {
  InvalidUrlError,
  AnalysisTimeoutError,
  ResourceNotFoundError,
} from '../errors.js';
import { AnalysisOptionsSchema, UrlSchema } from './schemas.js';

/**
 * Generate analysis summary from site analysis result
 */
function generateAnalysisSummary(result: any) {
  const domains = result.uniqueDomains.map((domain: string) => ({
    domain,
    requestCount: result.requests.filter((req: any) => {
      try {
        return new URL(req.url).hostname === domain;
      } catch {
        return false;
      }
    }).length,
  }));

  return {
    websiteInfo: {
      url: result.url,
      title: result.title,
      analysisTimestamp: result.analysisTimestamp,
      renderMethod: result.renderMethod,
    },
    requestSummary: {
      totalRequests: result.totalRequests,
      uniqueDomains: result.uniqueDomains.length,
      requestsByType: result.requestsByType,
    },
    domains,
    antiBotDetection: result.antiBotDetection,
    browserStorage: result.browserStorage,
  };
}

export async function handleAnalyzeWebsite(
  context: HandlerContext,
  options: unknown
): Promise<object> {
  let validatedOptions;
  try {
    validatedOptions = AnalysisOptionsSchema.parse(options);
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${
        error instanceof Error ? error.message : 'Unknown validation error'
      }`
    );
  }

  const {
    url,
    waitTime = context.config.timeouts.defaultWait,
    includeImages = false,
    quickMode = false,
  } = validatedOptions as any;

  context.logger.info(`[Analysis] Starting analysis of ${url}`);

  try {
    const result = await context.analyzer.analyzeWebsite({
      url,
      waitTime: quickMode ? context.config.timeouts.quickModeWait : waitTime,
      includeImages,
      quickMode,
    });

    // Store the analysis result for later retrieval
    context.analysisResults.set(url, result);

    // Generate and return domain summary
    const summary = generateAnalysisSummary(result);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      throw new McpError(ErrorCode.InvalidParams, error.message);
    } else if (error instanceof AnalysisTimeoutError) {
      throw new McpError(ErrorCode.RequestTimeout, error.message);
    } else if (error instanceof ResourceNotFoundError) {
      throw new McpError(ErrorCode.InvalidParams, error.message);
    } else {
      context.logger.error(
        `[Analysis] Unknown analysis error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new McpError(ErrorCode.InternalError, 'Unknown analysis error');
    }
  }
}

export async function handleGetRequestSummary(
  context: HandlerContext,
  url: unknown
): Promise<object> {
  let validatedUrl;
  try {
    validatedUrl = UrlSchema.parse(url);
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${
        error instanceof Error ? error.message : 'Unknown validation error'
      }`
    );
  }

  const result = context.analysisResults.get(validatedUrl);
  if (!result) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `No analysis found for URL: ${validatedUrl}. Please run analyze_website_requests first.`
    );
  }

  const summary = generateAnalysisSummary(result);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(summary, null, 2),
      },
    ],
  };
}
