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

  /**
   * Extract important elements from a page filtered by type and return selector information.
   * @param {Page} page - The browser page to analyze
   * @param {'text'|'image'|'link'|'script'} filterType - The type of elements to extract
   * @returns {Promise<Array<{ content: string, selector: string, type: string, tag: string, attributes: Record<string, string> }>>}
   */
  async extractImportantElements(
    page: Page,
    filterType: 'text' | 'image' | 'link' | 'script'
  ): Promise<Array<{ content: string, selector: string, type: string, tag: string, attributes: Record<string, string> }>> {
    try {
      const result = await page.evaluate((type: string) => {
        const elements: Element[] = [];
        switch (type) {
          case 'text': {
            const candidates = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span'));
            candidates.forEach((el) => elements.push(el));
            break;
          }
          case 'image': {
            elements.push(...Array.from(document.querySelectorAll('img')));
            break;
          }
          case 'link': {
            elements.push(...Array.from(document.querySelectorAll('a')));
            break;
          }
          case 'script': {
            elements.push(...Array.from(document.querySelectorAll('script')));
            break;
          }
          default:
            break;
        }
        return elements.map((el) => {
          const tag = (el as Element).tagName.toLowerCase();
          const id = (el as Element).id;
          const classList = Array.from((el as Element).classList || []);
          // Build selector
          let selector = '';
          if (id) {
            selector = `#${id}`;
          } else if (classList.length > 0) {
            selector = '.' + classList.join('.');
          } else {
            selector = tag;
          }

          // Content depending on type
          let content = '';
          if (type === 'text') {
            content = (el as HTMLElement).textContent?.trim() ?? '';
          } else if (type === 'image') {
            content = (el as HTMLImageElement).getAttribute('src') ?? '';
          } else if (type === 'link') {
            content = (el as HTMLAnchorElement).getAttribute('href') ?? '';
          } else if (type === 'script') {
            const src = (el as HTMLScriptElement).getAttribute('src');
            content = src ?? (el as HTMLScriptElement).textContent?.trim() ?? '';
          }

          // Attributes
          const attrs: Record<string, string> = {};
          const attrNames = (el as Element).getAttributeNames?.();
          if (attrNames) {
            attrNames.forEach((name) => {
              const value = (el as Element).getAttribute(name) ?? '';
              attrs[name] = value;
            });
          }

          return {
            content,
            selector,
            type,
            tag,
            attributes: attrs
          };
        });
      }, filterType);

      return Array.isArray(result) ? (result as any) : [];
    } catch (error) {
      this.logger.error(`[PageAnalyzer] Failed to extract elements: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}