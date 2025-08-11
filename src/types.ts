/**
 * Interface for captured HTTP request data
 */
export interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  resourceType: string;
}

/**
 * Interface for the site analysis result
 */
export interface SiteAnalysisResult {
  url: string;
  title: string;
  requests: CapturedRequest[];
  totalRequests: number;
  uniqueDomains: string[];
  requestsByType: Record<string, number>;
  analysisTimestamp: string;
}

/**
 * Configuration options for website analysis
 */
export interface AnalysisOptions {
  url: string;
  waitTime?: number;
  includeImages?: boolean;
  quickMode?: boolean;
}

/**
 * Request filter options
 */
export interface RequestFilter {
  url: string;
  domain?: string;
  requestId?: string;
}

/**
 * Domain summary for analysis results
 */
export interface DomainSummary {
  domain: string;
  requestCount: number;
}

/**
 * Analysis summary returned to client
 */
export interface AnalysisSummary {
  websiteInfo: {
    url: string;
    title: string;
    analysisTimestamp: string;
  };
  requestSummary: {
    totalRequests: number;
    uniqueDomains: number;
    requestsByType: Record<string, number>;
  };
  domains: DomainSummary[];
}