import { type CapturedRequest } from "../types.js";
import { config } from "../config.js";

/**
 * Service responsible for detecting anti-bot systems and captchas
 */
export class SecurityAnalyzer {
  /**
   * Detect anti-bot/captcha systems based on requests and page content
   * @param {CapturedRequest[]} capturedRequests - Array of captured requests
   * @param {string} title - The page title
   * @returns {SiteAnalysisResult["antiBotDetection"]} Anti-bot detection result
   */
  detectAntiBotSystems(capturedRequests: CapturedRequest[], title: string): {
    detected: boolean;
    type?: "captcha" | "rate-limiting" | "behavioral-analysis" | "other" | "unknown";
    details?: string;
  } {
    // Check for common captcha indicators in requests
    const captchaDomains = config.detection.captchaDomains;

    // Check for rate limiting indicators
    const rateLimitStatusCodes = [429];
    const rateLimitHeaders = ["rate-limit", "x-ratelimit", "retry-after"];

    // Check for common anti-bot service domains
    const antiBotDomains = config.detection.antiBotDomains;

    // Check for captcha in requests
    const captchaRequest = capturedRequests.find(req =>
      captchaDomains.some(domain => req.url.includes(domain))
    );

    if (captchaRequest) {
      return {
        detected: true,
        type: "captcha",
        details: `Captcha detected from domain: ${new URL(captchaRequest.url).hostname}`
      };
    }

    // Check for rate limiting in responses
    const rateLimitResponse = capturedRequests.find(req =>
      (req.status && rateLimitStatusCodes.includes(req.status)) ||
      (req.responseHeaders && Object.keys(req.responseHeaders).some(header =>
        rateLimitHeaders.some(rlHeader => header.toLowerCase().includes(rlHeader))))
    );

    if (rateLimitResponse) {
      return {
        detected: true,
        type: "rate-limiting",
        details: `Rate limiting detected with status code: ${rateLimitResponse.status}`
      };
    }

    // Check for anti-bot services in requests
    const antiBotRequest = capturedRequests.find(req =>
      antiBotDomains.some(domain => req.url.includes(domain))
    );

    if (antiBotRequest) {
      return {
        detected: true,
        type: "behavioral-analysis",
        details: `Anti-bot service detected from domain: ${new URL(antiBotRequest.url).hostname}`
      };
    }

    // Check for common captcha indicators in title
    const captchaTitleIndicators = ["captcha", "security check", "are you a robot"];
    const hasCaptchaInTitle = captchaTitleIndicators.some(indicator =>
      title.toLowerCase().includes(indicator)
    );

    if (hasCaptchaInTitle) {
      return {
        detected: true,
        type: "captcha",
        details: "Captcha indicated in page title"
      };
    }

    // Default case - no anti-bot systems detected
    return {
      detected: false
    };
  }
}