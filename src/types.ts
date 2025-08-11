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
  renderMethod: "client" | "server" | "unknown";
  antiBotDetection: {
    detected: boolean;
    type?: "captcha" | "rate-limiting" | "behavioral-analysis" | "other" | "unknown";
    details?: string;
  };
  browserStorage?: {
    cookies?: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "Strict" | "Lax" | "None";
    }>;
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
  };
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
    renderMethod: "client" | "server" | "unknown";
  };
  requestSummary: {
    totalRequests: number;
    uniqueDomains: number;
    requestsByType: Record<string, number>;
  };
  domains: DomainSummary[];
  antiBotDetection: {
    detected: boolean;
    type?: "captcha" | "rate-limiting" | "behavioral-analysis" | "other" | "unknown";
    details?: string;
  };
  browserStorage?: {
    cookies?: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "Strict" | "Lax" | "None";
    }>;
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
  };
}