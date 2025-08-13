import { type Page } from "patchright";
import { Logger } from "../logger.js";
import { type SiteAnalysisResult } from "../types.js";

/**
 * Service responsible for extracting cookies, localStorage, and sessionStorage
 */
export class StorageCapturer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Capture browser storage data (cookies, localStorage, sessionStorage)
   * @param {Page} page - The browser page to capture storage from
   * @returns {Promise<SiteAnalysisResult["browserStorage"]>} Browser storage data
   */
  async captureBrowserStorage(page: Page): Promise<SiteAnalysisResult["browserStorage"]> {
    try {
      // Capture cookies
      const cookies = await page.context().cookies();
      
      // Capture localStorage
      const localStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key !== null) {
              items[key] = window.localStorage.getItem(key) || '';
            }
          }
        }
        return items;
      });
      
      // Capture sessionStorage
      const sessionStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        if (typeof window !== 'undefined' && window.sessionStorage) {
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key !== null) {
              items[key] = window.sessionStorage.getItem(key) || '';
            }
          }
        }
        return items;
      });
      
      return {
        cookies,
        localStorage,
        sessionStorage
      };
    } catch (error) {
      this.logger.error(`[BrowserStorage] Failed to capture browser storage: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}