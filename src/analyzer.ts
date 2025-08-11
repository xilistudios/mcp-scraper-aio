import { type Page } from "patchright";
import { randomUUID } from "crypto";
import { BrowserManager } from "./browser.js";
import { type CapturedRequest, type SiteAnalysisResult, type AnalysisOptions } from "./types.js";

/**
 * Website analyzer class responsible for capturing and analyzing HTTP requests
 */
export class WebsiteAnalyzer {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Capture HTTP requests from a given URL and analyze the site
   * @param {AnalysisOptions} options - Analysis configuration options
   * @returns {Promise<SiteAnalysisResult>} Analysis result containing captured requests
   * @throws {Error} If analysis fails or URL is invalid
   */
  async analyzeWebsite(options: AnalysisOptions): Promise<SiteAnalysisResult> {
    const { url, waitTime = 3000, includeImages = false, quickMode = false } = options;

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL provided. Please include http:// or https://");
    }

    await this.browserManager.initialize();
    const context = this.browserManager.getContext();
    const page = await context.newPage();
    const capturedRequests: CapturedRequest[] = [];

    try {
      console.error(`[Setup] Setting up request monitoring for ${url}`);

      // Set up request monitoring
      this.setupRequestMonitoring(page, capturedRequests, includeImages);

      console.error(`[Navigation] Loading ${url}...`);

      // Navigate to the URL with timeout protection
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000 // 30 seconds max
      });

      // Wait for network stability
      await this.waitForNetworkStability(page);

      // Wait for additional dynamic content if specified
      const actualWaitTime = quickMode ? 1000 : Math.min(waitTime, 10000);
      if (actualWaitTime > 0) {
        console.error(`[Wait] Waiting ${actualWaitTime}ms for additional requests...`);
        await page.waitForTimeout(actualWaitTime);
      }

      // Extract page information and analyze requests
      const title = await page.title();
      const analysisResult = this.generateAnalysisResult(url, title, capturedRequests);

      console.error(`[Complete] Captured ${capturedRequests.length} requests from ${analysisResult.uniqueDomains.length} domains`);

      await page.close();
      return analysisResult;

    } catch (error) {
      console.error(`[Error] Failed to analyze ${url}:`, error);
      await page.close();

      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          throw new Error(`Website analysis timed out for ${url}. The site may be slow to load or have blocking resources.`);
        }
        throw new Error(`Failed to analyze website: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Set up request and response monitoring for the page
   * @param {Page} page - The browser page to monitor
   * @param {CapturedRequest[]} capturedRequests - Array to store captured requests
   * @param {boolean} includeImages - Whether to include image and media requests
   */
  private setupRequestMonitoring(page: Page, capturedRequests: CapturedRequest[], includeImages: boolean): void {
    // Monitor outgoing requests
    page.on("request", (request) => {
      const resourceType = request.resourceType();

      // Skip images unless specifically requested
      if (!includeImages && (resourceType === "image" || resourceType === "media")) {
        return;
      }

      const capturedRequest: CapturedRequest = {
        id: randomUUID(),
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() || undefined,
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
      };

      capturedRequests.push(capturedRequest);
      console.error(`[Request] ${request.method()} ${request.url()}`);
    });

    // Monitor incoming responses
    page.on("response", async (response) => {
      await this.captureResponseData(capturedRequests, response);
    });
  }

  /**
   * Capture response data and associate it with the corresponding request
   * @param {CapturedRequest[]} capturedRequests - Array of captured requests
   * @param {Response} response - The response object from the browser
   */
  private async captureResponseData(capturedRequests: CapturedRequest[], response: any): Promise<void> {
    // Find the corresponding request and add response data
    const requestIndex = capturedRequests.findIndex(
      (req) => req.url === response.url() && !req.status
    );

    if (requestIndex >= 0 && requestIndex < capturedRequests.length) {
      const request = capturedRequests[requestIndex];
      if (request) {
        request.status = response.status();
        request.responseHeaders = response.headers();

        // Capture response body for text-based content only
        try {
          const contentType = response.headers()["content-type"] || "";
          const resourceType = request.resourceType;

          if (this.shouldCaptureResponseBody(resourceType, contentType)) {
            const responseBody = await response.text();
            request.responseBody = this.truncateResponseBody(responseBody);
          }
        } catch (error) {
          console.error(`[Response] Failed to capture response body for ${response.url()}:`, error);
          request.responseBody = "[Failed to capture response body]";
        }
      }
    }
  }

  /**
   * Determine if response body should be captured based on content type and resource type
   * @param {string} resourceType - The resource type from the request
   * @param {string} contentType - The content type from the response headers
   * @returns {boolean} True if response body should be captured
   */
  private shouldCaptureResponseBody(resourceType: string, contentType: string): boolean {
    return (
      resourceType !== "image" &&
      resourceType !== "media" &&
      resourceType !== "font" &&
      !contentType.includes("image/") &&
      !contentType.includes("video/") &&
      !contentType.includes("audio/") &&
      !contentType.includes("application/octet-stream")
    );
  }

  /**
   * Truncate response body if it exceeds size limit
   * @param {string} responseBody - The response body content
   * @returns {string} Truncated response body or original if within limit
   */
  private truncateResponseBody(responseBody: string): string {
    const MAX_SIZE = 50000;
    return responseBody.length > MAX_SIZE
      ? responseBody.substring(0, MAX_SIZE) + "\n... [Response body truncated - too large]"
      : responseBody;
  }

  /**
   * Wait for network stability with timeout protection
   * @param {Page} page - The browser page to wait for
   */
  private async waitForNetworkStability(page: Page): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (error) {
      console.error("[Wait] Network idle timeout reached, continuing with analysis...");
    }
  }

  /**
   * Generate analysis result from captured requests
   * @param {string} url - The analyzed URL
   * @param {string} title - The page title
   * @param {CapturedRequest[]} capturedRequests - Array of captured requests
   * @returns {SiteAnalysisResult} Complete analysis result
   */
  private generateAnalysisResult(url: string, title: string, capturedRequests: CapturedRequest[]): SiteAnalysisResult {
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

    return {
      url,
      title,
      requests: capturedRequests,
      totalRequests: capturedRequests.length,
      uniqueDomains,
      requestsByType,
      analysisTimestamp: new Date().toISOString(),
    };
  }
}