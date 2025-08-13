import { type Page } from "patchright";
import { Logger } from "../logger.js";

/**
 * Service responsible for analyzing the page itself (detecting rendering method)
 */
export class PageAnalyzer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Detect if a website uses client-side or server-side rendering
   * @param {Page} page - The browser page to analyze
   * @returns {Promise<"client" | "server" | "unknown">} The detected render method
   */
  async detectRenderMethod(page: Page): Promise<"client" | "server" | "unknown"> {
    try {
      // Get the initial HTML content
      const initialHTML = await page.content();
      
      // Check for common client-side rendering indicators
      const hasReactHydration = initialHTML.includes('data-reactroot') || initialHTML.includes('data-reactid') || initialHTML.includes('data-react-helmet');
      const hasVueHydration = initialHTML.includes('data-server-rendered') || initialHTML.includes('v-bind') || initialHTML.includes('v-on:');
      const hasAngularHydration = initialHTML.includes('ng-version') || initialHTML.includes('_nghost') || initialHTML.includes('_ngcontent');
      
      // Check for common server-side rendering indicators
      const hasSSRIndicators = initialHTML.includes('data-ssr') || initialHTML.includes('data-server-rendered');
      
      // Check if the page has minimal content (indicative of client-side rendering)
      const bodyMatch = initialHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : '';
      const hasMinimalContent = bodyContent && bodyContent.length < 500 && !bodyContent.includes('<article') && !bodyContent.includes('<section');
      
      // Check for common frameworks
      const hasNextJS = initialHTML.includes('__NEXT_DATA__');
      const hasNuxtJS = initialHTML.includes('window.__NUXT__');
      
      // Determine render method based on indicators
      if (hasNextJS || hasNuxtJS || hasSSRIndicators) {
        return "server";
      } else if (hasReactHydration || hasVueHydration || hasAngularHydration || hasMinimalContent) {
        return "client";
      } else {
        return "unknown";
      }
    } catch (error) {
      this.logger.error(`[RenderMethod] Failed to detect render method: ${error instanceof Error ? error.message : String(error)}`);
      return "unknown";
    }
  }
}