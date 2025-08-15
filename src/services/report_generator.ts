import { type CapturedRequest, type SiteAnalysisResult } from "../types.js";
import { SecurityAnalyzer } from "./security_analyzer.js";

/**
 * Service responsible for generating the final SiteAnalysisResult from raw data
 */
export class ReportGenerator {
  private securityAnalyzer: SecurityAnalyzer;

  constructor() {
    this.securityAnalyzer = new SecurityAnalyzer();
  }

  /**
   * Generate analysis result from captured requests
   * @param {string} url - The analyzed URL
   * @param {string} title - The page title
   * @param {CapturedRequest[]} capturedRequests - Array of captured requests
   * @param {"client" | "server" | "unknown"} renderMethod - The detected render method
   * @param {SiteAnalysisResult["browserStorage"]} browserStorage - The captured browser storage data
   * @returns {SiteAnalysisResult} Complete analysis result
   */
  generateAnalysisResult(
    url: string,
    title: string,
    capturedRequests: CapturedRequest[],
    renderMethod: "client" | "server" | "unknown",
    browserStorage?: SiteAnalysisResult["browserStorage"]
  ): SiteAnalysisResult {
    // Extract unique domains from requests
    const uniqueDomains = Array.from(
      new Set(capturedRequests.map((req) => {
        try {
          return new URL(req.url).hostname;
        } catch {
          return "invalid-url";
        }
      }))
    );

    // Count requests by resource type
    const requestsByType = capturedRequests.reduce<Record<string, number>>((acc, req) => {
      acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
      return acc;
    }, {});

    // Detect anti-bot/captcha systems
    const antiBotDetection = this.securityAnalyzer.detectAntiBotSystems(capturedRequests, title);

    return {
      url,
      title,
      requests: capturedRequests,
      totalRequests: capturedRequests.length,
      uniqueDomains,
      requestsByType,
      analysisTimestamp: new Date().toISOString(),
      renderMethod,
      antiBotDetection,
      browserStorage,
    };
  }
}