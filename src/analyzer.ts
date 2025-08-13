import { type Page, type Response } from "patchright";
import { BrowserManager } from "./browser.js";
import { type CapturedRequest, type SiteAnalysisResult, type AnalysisOptions } from "./types.js";
import { Logger } from "./logger.js";
import { RequestMonitor } from "./services/request_monitor.js";
import { PageAnalyzer } from "./services/page_analyzer.js";
import { StorageCapturer } from "./services/storage_capturer.js";
import { ReportGenerator } from "./services/report_generator.js";
import { config } from "./config.js";
import { InvalidUrlError, AnalysisTimeoutError } from "./errors.js";

/**
 * Website analyzer class responsible for capturing and analyzing HTTP requests
 */
export class WebsiteAnalyzer {
  private browserManager: BrowserManager;
  private logger: Logger;
  private requestMonitor: RequestMonitor;
  private pageAnalyzer: PageAnalyzer;
  private storageCapturer: StorageCapturer;
  private reportGenerator: ReportGenerator;

  constructor(browserManager: BrowserManager, logger: Logger) {
    this.browserManager = browserManager;
    this.logger = logger;
    this.requestMonitor = new RequestMonitor(logger);
    this.pageAnalyzer = new PageAnalyzer(logger);
    this.storageCapturer = new StorageCapturer(logger);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Capture HTTP requests from a given URL and analyze the site
   * @param {AnalysisOptions} options - Analysis configuration options
   * @returns {Promise<SiteAnalysisResult>} Analysis result containing captured requests
   * @throws {Error} If analysis fails or URL is invalid
   */
  async analyzeWebsite(options: AnalysisOptions): Promise<SiteAnalysisResult> {
    const { url, waitTime = config.timeouts.defaultWait, includeImages = false, quickMode = false } = options;

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new InvalidUrlError("Invalid URL provided. Please include http:// or https://");
    }

    await this.browserManager.initialize();
    const context = this.browserManager.getContext();
    const page = await context.newPage();
    const capturedRequests: CapturedRequest[] = [];

    try {
      this.logger.info(`[Setup] Setting up request monitoring for ${url}`);

      // Set up request monitoring
      this.requestMonitor.setupRequestMonitoring(page, capturedRequests, includeImages);

      this.logger.info(`[Navigation] Loading ${url}...`);

      // Navigate to the URL with timeout protection
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.timeouts.navigation // 30 seconds max
      });

      // Wait for network stability
      await this.waitForNetworkStability(page);

      // Wait for additional dynamic content if specified
      const actualWaitTime = quickMode ? config.timeouts.quickModeWait : Math.min(waitTime, 10000);
      if (actualWaitTime > 0) {
        this.logger.info(`[Wait] Waiting ${actualWaitTime}ms for additional requests...`);
        await page.waitForTimeout(actualWaitTime);
      }

      // Extract page information and analyze requests
      const title = await page.title();
      const renderMethod = await this.pageAnalyzer.detectRenderMethod(page);
      const browserStorage = await this.storageCapturer.captureBrowserStorage(page);
      const analysisResult = this.reportGenerator.generateAnalysisResult(url, title, capturedRequests, renderMethod, browserStorage);

      this.logger.info(`[Complete] Captured ${capturedRequests.length} requests from ${analysisResult.uniqueDomains.length} domains`);

      await page.close();
      return analysisResult;

    } catch (error) {
      this.logger.error(`[Error] Failed to analyze ${url}: ${error instanceof Error ? error.message : String(error)}`);
      await page.close();

      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          throw new AnalysisTimeoutError(`Website analysis timed out for ${url}. The site may be slow to load or have blocking resources.`);
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
  setupRequestMonitoring(page: Page, capturedRequests: CapturedRequest[], includeImages: boolean): void {
    this.requestMonitor.setupRequestMonitoring(page, capturedRequests, includeImages);
  }

  /**
   * Detect if a website uses client-side or server-side rendering
   * @param {Page} page - The browser page to analyze
   * @returns {Promise<"client" | "server" | "unknown">} The detected render method
   */
  async detectRenderMethod(page: Page): Promise<"client" | "server" | "unknown"> {
    return this.pageAnalyzer.detectRenderMethod(page);
  }

  /**
   * Capture browser storage data (cookies, localStorage, sessionStorage)
   * @param {Page} page - The browser page to capture storage from
   * @returns {Promise<SiteAnalysisResult["browserStorage"]>} Browser storage data
   */
  async captureBrowserStorage(page: Page): Promise<SiteAnalysisResult["browserStorage"]> {
    return this.storageCapturer.captureBrowserStorage(page);
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
    return this.reportGenerator.generateAnalysisResult(url, title, capturedRequests, renderMethod, browserStorage);
  }

  /**
   * Detect anti-bot/captcha systems based on requests and page content
   * @param {CapturedRequest[]} capturedRequests - Array of captured requests
   * @param {string} title - The page title
   * @returns {Promise<SiteAnalysisResult["antiBotDetection"]>} Anti-bot detection result
   */
  async detectAntiBotSystems(capturedRequests: CapturedRequest[], title: string): Promise<SiteAnalysisResult["antiBotDetection"]> {
    // Use dynamic import to load SecurityAnalyzer in an ESM-friendly way
    try {
      const { SecurityAnalyzer } = await import("./services/security_analyzer.js");
      const securityAnalyzer = new SecurityAnalyzer();
      return securityAnalyzer.detectAntiBotSystems(capturedRequests, title);
    } catch (error) {
      this.logger.error(`[Error] Failed to dynamically import SecurityAnalyzer: ${error instanceof Error ? error.message : String(error)}`);
      // Return a safe default when the analyzer cannot be loaded
      return { detected: false, type: "unknown", details: "SecurityAnalyzer unavailable due to import error" };
    }
  }

  /**
   * Wait for network stability with timeout protection
   * @param {Page} page - The browser page to wait for
   */
  private async waitForNetworkStability(page: Page): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", { timeout: config.timeouts.networkIdle });
    } catch (error) {
      this.logger.warn("[Wait] Network idle timeout reached, continuing with analysis...");
    }
  }

  /**
   * @deprecated This method is kept for backward compatibility but is no longer used.
   * Use RequestMonitor for request monitoring instead.
   */
  private async captureResponseData(capturedRequests: CapturedRequest[], response: Response): Promise<void> {
    // This method is now handled by RequestMonitor, but kept for backward compatibility
    // with any code that might be calling it directly
  }

  /**
   * @deprecated This method is kept for backward compatibility but is no longer used.
   * Use RequestMonitor for request monitoring instead.
   */
  private shouldCaptureResponseBody(resourceType: string, contentType: string): boolean {
    // This method is now handled by RequestMonitor, but kept for backward compatibility
    return true;
  }

  /**
   * @deprecated This method is kept for backward compatibility but is no longer used.
   * Use RequestMonitor for request monitoring instead.
   */
  private truncateResponseBody(responseBody: string): string {
    // This method is now handled by RequestMonitor, but kept for backward compatibility
    return responseBody.length > config.limits.maxResponseBodySize
      ? responseBody.substring(0, config.limits.maxResponseBodySize) + "\n... [Response body truncated - too large]"
      : responseBody;
  }
}