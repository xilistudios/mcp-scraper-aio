import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { WebsiteAnalyzer } from "./analyzer.js";
import {
  type SiteAnalysisResult,
  type AnalysisOptions,
  type RequestFilter,
  type AnalysisSummary,
  type DomainSummary
} from "./types.js";
import { Logger } from "./logger.js";
import { config } from "./config.js";
import { InvalidUrlError, AnalysisTimeoutError, ResourceNotFoundError } from "./errors.js";
import { z } from "zod";

// Zod schemas for input validation
const AnalysisOptionsSchema = z.object({
  url: z.string().url("URL must be a valid URL with http:// or https://"),
  waitTime: z.number().min(0).max(10000).optional(),
  includeImages: z.boolean().optional(),
  quickMode: z.boolean().optional()
});

const RequestFilterSchema = z.object({
  url: z.string().url("URL must be a valid URL with http:// or https://"),
  domain: z.string().optional(),
  requestId: z.string().optional()
});

const UrlSchema = z.string().url("URL must be a valid URL with http:// or https://");

/**
 * MCP tool handlers for web scraping and analysis functionality
 */
export class MCPToolHandlers {
  private analyzer: WebsiteAnalyzer;
  private analysisResults: Map<string, SiteAnalysisResult> = new Map();
  private logger: Logger;

  constructor(analyzer: WebsiteAnalyzer, logger: Logger) {
    this.analyzer = analyzer;
    this.logger = logger;
  }

  /**
   * Handle website analysis request
   * @param {AnalysisOptions} options - Analysis configuration options
   * @returns {Promise<object>} MCP response with analysis summary
   * @throws {McpError} If URL is invalid or analysis fails
   */
  async handleAnalyzeWebsite(options: unknown): Promise<object> {
    // Validate input using zod schema
    let validatedOptions;
    try {
      validatedOptions = AnalysisOptionsSchema.parse(options);
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error instanceof Error ? error.message : 'Unknown validation error'}`
      );
    }
    const { url, waitTime = config.timeouts.defaultWait, includeImages = false, quickMode = false } = validatedOptions;

    this.logger.info(`[Analysis] Starting analysis of ${url}`);

    try {
      const result = await this.analyzer.analyzeWebsite({
        url,
        waitTime: quickMode ? config.timeouts.quickModeWait : waitTime,
        includeImages,
        quickMode
      });

      // Store the analysis result for later retrieval
      this.analysisResults.set(url, result);

      // Generate and return domain summary
      const summary = this.generateAnalysisSummary(result);

      return {
        content: [
          {
            type: "text",
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
        throw new McpError(ErrorCode.InternalError, "Unknown analysis error");
      }
    }
  }

  /**
   * Handle getting requests filtered by domain
   * @param {RequestFilter} filter - Request filter options
   * @returns {Promise<object>} MCP response with filtered requests
   * @throws {McpError} If analysis not found or domain is invalid
   */
  async handleGetRequestsByDomain(filter: unknown): Promise<object> {
    // Validate input using zod schema
    let validatedFilter;
    try {
      validatedFilter = RequestFilterSchema.parse(filter);
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error instanceof Error ? error.message : 'Unknown validation error'}`
      );
    }
    const { url, domain } = validatedFilter;

    // This check is now redundant due to zod validation, but kept for clarity
    if (!domain) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Domain parameter is required"
      );
    }

    const result = this.analysisResults.get(url);

    if (!result) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `No analysis found for URL: ${url}. Please run analyze_website_requests first.`
      );
    }

    const domainRequests = result.requests.filter(req => {
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
      requests: domainRequests.map(req => ({
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
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  /**
   * Handle getting full request details by ID
   * @param {RequestFilter} filter - Request filter options
   * @returns {Promise<object>} MCP response with request details
   * @throws {McpError} If analysis or request not found
   */
  async handleGetRequestDetails(filter: unknown): Promise<object> {
    // Validate input using zod schema
    let validatedFilter;
    try {
      validatedFilter = RequestFilterSchema.parse(filter);
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error instanceof Error ? error.message : 'Unknown validation error'}`
      );
    }
    const { url, requestId } = validatedFilter;

    // This check is now redundant due to zod validation, but kept for clarity
    if (!requestId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Request ID parameter is required"
      );
    }

    const result = this.analysisResults.get(url);

    if (!result) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `No analysis found for URL: ${url}. Please run analyze_website_requests first.`
      );
    }

    const request = result.requests.find(req => req.id === requestId);

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
          type: "text",
          text: JSON.stringify(details, null, 2),
        },
      ],
    };
  }

  /**
   * Handle getting request summary for a previously analyzed URL
   * @param {string} url - The URL to get summary for
   * @returns {Promise<object>} MCP response with request summary
   * @throws {McpError} If analysis not found
   */
  async handleGetRequestSummary(url: unknown): Promise<object> {
    // Validate input using zod schema
    let validatedUrl;
    try {
      validatedUrl = UrlSchema.parse(url);
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error instanceof Error ? error.message : 'Unknown validation error'}`
      );
    }

    const result = this.analysisResults.get(validatedUrl);
    if (!result) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `No analysis found for URL: ${validatedUrl}. Please run analyze_website_requests first.`
      );
    }

    const summary = this.generateAnalysisSummary(result);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  /**
   * Generate analysis summary from site analysis result
   * @param {SiteAnalysisResult} result - The analysis result to summarize
   * @returns {AnalysisSummary} Formatted analysis summary
   */
  private generateAnalysisSummary(result: SiteAnalysisResult): AnalysisSummary {
    const domains: DomainSummary[] = result.uniqueDomains.map(domain => ({
      domain,
      requestCount: result.requests.filter(req => {
        try {
          return new URL(req.url).hostname === domain;
        } catch {
          return false;
        }
      }).length
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

  /**
   * Clear stored analysis results (for testing or memory management)
   */
  clearAnalysisResults(): void {
    this.analysisResults.clear();
  }

  /**
   * Get the number of stored analysis results
   * @returns {number} Number of stored results
   */
  getStoredResultsCount(): number {
    return this.analysisResults.size;
  }
}