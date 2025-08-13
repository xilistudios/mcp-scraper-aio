import { chromium, type Browser, type BrowserContext } from "patchright";
import { Logger } from "./logger.js";

/**
 * Browser manager class responsible for browser lifecycle management
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize browser and context if not already initialized
   * @throws {Error} If browser initialization fails
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.logger.info("[Browser] Launching browser...");
      this.browser = await chromium.launch({
        headless: true, // Use headless for MCP server
        args: [
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      });
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
      });
    }
  }

  /**
   * Get the browser context
   * @returns {BrowserContext} The current browser context
   * @throws {Error} If context is not initialized
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error("Browser context not initialized. Call initialize() first.");
    }
    return this.context;
  }

  /**
   * Check if browser is initialized
   * @returns {boolean} True if browser is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null;
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("[Cleanup] Shutting down browser...");

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}