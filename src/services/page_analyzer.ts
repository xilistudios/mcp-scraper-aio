import { type Page } from 'patchright';
import { Logger } from '../logger.js';

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
  async detectRenderMethod(
    page: Page
  ): Promise<'client' | 'server' | 'unknown'> {
    try {
      // Get the initial HTML content
      const initialHTML = await page.content();

      // Check for common client-side rendering indicators
      const hasReactHydration =
        initialHTML.includes('data-reactroot') ||
        initialHTML.includes('data-reactid') ||
        initialHTML.includes('data-react-helmet');
      const hasVueHydration =
        initialHTML.includes('data-server-rendered') ||
        initialHTML.includes('v-bind') ||
        initialHTML.includes('v-on:');
      const hasAngularHydration =
        initialHTML.includes('ng-version') ||
        initialHTML.includes('_nghost') ||
        initialHTML.includes('_ngcontent');

      // Check for common server-side rendering indicators
      const hasSSRIndicators =
        initialHTML.includes('data-ssr') ||
        initialHTML.includes('data-server-rendered');

      // Check if the page has minimal content (indicative of client-side rendering)
      const bodyMatch = initialHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : '';
      const hasMinimalContent =
        bodyContent &&
        bodyContent.length < 500 &&
        !bodyContent.includes('<article') &&
        !bodyContent.includes('<section');

      // Check for common frameworks
      const hasNextJS = initialHTML.includes('__NEXT_DATA__');
      const hasNuxtJS = initialHTML.includes('window.__NUXT__');

      // Determine render method based on indicators
      if (hasNextJS || hasNuxtJS || hasSSRIndicators) {
        return 'server';
      } else if (
        hasReactHydration ||
        hasVueHydration ||
        hasAngularHydration ||
        hasMinimalContent
      ) {
        return 'client';
      } else {
        return 'unknown';
      }
    } catch (error) {
      this.logger.error(
        `[RenderMethod] Failed to detect render method: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 'unknown';
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
  ): Promise<
    Array<{
      content: string;
      selector: string;
      type: string;
      tag: string;
      attributes: Record<string, string>;
    }>
  > {
    this.logger.debug?.(
      `[PageAnalyzer] Starting extraction type=${filterType}`
    );
    try {
      const result = await page.evaluate((type: string) => {
        const elements: any[] = [];
        switch (type) {
          case 'text': {
            const candidates = Array.from(
              document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span')
            );
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

        function escapeIdentifier(str: string): string {
          if (typeof str !== 'string') return '';
          try {
            if ((window as any).CSS && (window as any).CSS.escape) {
              return (window as any).CSS.escape(str);
            }
          } catch (e) {
            // ignore and fallback to regex escape
          }
          return str.replace(/([ #;&,.+*~\':"!^$\[\]()=>|\\/])/g, '\\$1');
        }

        /**
         * Safer getUniqueSelector that works in browser and in lightweight test fakes.
         * Prioritize: id -> class list (joined) -> tag
         * Wrapped in try/catch to avoid throwing inside page.evaluate in odd environments.
         */
        function getUniqueSelector(element: any): string {
          try {
            if (!element || typeof element !== 'object') return '';

            // Prefer id when present
            if (
              element.id &&
              typeof element.id === 'string' &&
              element.id.trim()
            ) {
              return `#${escapeIdentifier(element.id)}`;
            }

            // Use classes if present (join with dot, e.g. .a.b)
            const rawClassList = element.classList || element.class || [];
            // Normalize classList to array of strings
            const classes =
              Array.isArray(rawClassList) && rawClassList.length > 0
                ? rawClassList
                : typeof rawClassList === 'string' && rawClassList.trim()
                ? rawClassList.trim().split(/\s+/)
                : [];

            if (Array.isArray(classes) && classes.length > 0) {
              const joined = classes.map(escapeIdentifier).join('.');
              return `.${joined}`;
            }

            // Fallback to tag name (support tagName or nodeName)
            const tag = (element.tagName || element.nodeName || '')
              .toString()
              .toLowerCase();

            return tag || '';
          } catch (err) {
            try {
              // Best-effort fallback: return tag or empty string
              const tagFallback =
                element && (element.tagName || element.nodeName || '');
              try {
                // Log inside page context if available
                // eslint-disable-next-line no-console
                console.error(
                  '[PageAnalyzer:getUniqueSelector] error',
                  err,
                  'element',
                  {
                    id: element?.id,
                    classList: element?.classList,
                    tagName: element?.tagName || element?.nodeName,
                  }
                );
              } catch (_) {}
              return (tagFallback || '').toString().toLowerCase();
            } catch (_) {
              return '';
            }
          }
        }

        return elements.map((el) => {
          const tag = ((el && (el.tagName || el.nodeName)) || '')
            .toString()
            .toLowerCase();
          let selector = '';
          try {
            selector = getUniqueSelector(el);
            // Ensure selector is a non-empty string; fallback to tag when empty
            if (!selector || selector.trim() === '') {
              selector = tag || '';
            }
          } catch (e) {
            try {
              // eslint-disable-next-line no-console
              console.error('[PageAnalyzer] selector generation failed', e);
            } catch (_) {}
            selector = tag || '';
          }

          // Content depending on type
          let content = '';
          try {
            if (type === 'text') {
              content = (el && (el.textContent ?? '')).toString().trim();
            } else if (type === 'image') {
              content = (el && el.getAttribute && el.getAttribute('src')) ?? '';
            } else if (type === 'link') {
              content =
                (el && el.getAttribute && el.getAttribute('href')) ?? '';
            } else if (type === 'script') {
              const src = el && el.getAttribute && el.getAttribute('src');
              content =
                src ?? (el && (el.textContent ?? '')).toString().trim() ?? '';
            }
          } catch (e) {
            try {
              // eslint-disable-next-line no-console
              console.error('[PageAnalyzer] content extraction failed', e);
            } catch (_) {}
            content = '';
          }

          // Attributes
          const attrs: Record<string, string> = {};
          try {
            const attrNames =
              (el &&
                typeof el.getAttributeNames === 'function' &&
                el.getAttributeNames()) ||
              // In tests some elements expose a keys list via object keys
              (el &&
                Object.keys(el).filter((k) => typeof el[k] !== 'function')) ||
              [];
            if (Array.isArray(attrNames)) {
              attrNames.forEach((name: string) => {
                try {
                  const value =
                    (el &&
                      (typeof el.getAttribute === 'function'
                        ? el.getAttribute(name)
                        : (el as any)[name])) ??
                    '';
                  attrs[name] = value;
                } catch (e) {
                  attrs[name] = '';
                }
              });
            }
          } catch (e) {
            // ignore attributes extraction errors
          }

          return {
            content,
            selector,
            type,
            tag,
            attributes: attrs,
          };
        });
      }, filterType);

      const count = Array.isArray(result) ? result.length : 0;
      this.logger.debug?.(
        `[PageAnalyzer] Extracted ${count} elements for type=${filterType}`
      );

      return Array.isArray(result) ? (result as any) : [];
    } catch (error) {
      this.logger.error(
        `[PageAnalyzer] Failed to extract elements: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }
}
