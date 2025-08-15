import { WebsiteAnalyzer } from './analyzer.js';
import { Logger } from './logger.js';
import { config } from './config.js';

import * as analysisHandlers from './handlers/analysis.js';
import * as requestHandlers from './handlers/request.js';
import * as fetchHandlers from './handlers/fetch.js';
import * as extractHandlers from './handlers/extract.js';

export type HandlerContext = {
  analyzer: WebsiteAnalyzer;
  analysisResults: Map<string, any>;
  logger: Logger;
  config: typeof config;
};

/**
 * MCP tool handlers that delegate to modular handler implementations.
 * Maintains backward-compatible method signatures.
 */
export class MCPToolHandlers {
  private analyzer: WebsiteAnalyzer;
  private analysisResults: Map<string, any> = new Map();
  private logger: Logger;
  public context: HandlerContext;

  constructor(analyzer: WebsiteAnalyzer, logger: Logger) {
    this.analyzer = analyzer;
    this.logger = logger;
    this.context = {
      analyzer: this.analyzer,
      analysisResults: this.analysisResults,
      logger: this.logger,
      config,
    };
  }

  async handleAnalyzeWebsite(options: unknown): Promise<object> {
    return analysisHandlers.handleAnalyzeWebsite(this.context, options);
  }

  async handleGetRequestsByDomain(filter: unknown): Promise<object> {
    return requestHandlers.handleGetRequestsByDomain(this.context, filter);
  }

  async handleGetRequestDetails(filter: unknown): Promise<object> {
    return requestHandlers.handleGetRequestDetails(this.context, filter);
  }

  async handleGetRequestSummary(url: unknown): Promise<object> {
    return analysisHandlers.handleGetRequestSummary(this.context, url);
  }

  async handleFetch(options: unknown): Promise<object> {
    return fetchHandlers.handleFetch(this.context, options);
  }

  async handleExtractHtmlElements(params: unknown): Promise<object> {
    return extractHandlers.handleExtractHtmlElements(this.context, params);
  }

  /** Clear stored analysis results (for testing or memory management) */
  clearAnalysisResults(): void {
    this.analysisResults.clear();
  }

  /** Get number of stored analysis results (for testing) */
  getStoredResultsCount(): number {
    return this.analysisResults.size;
  }
}
