import { PageAnalyzer } from "../services/page_analyzer";
import { Logger } from "../logger";

describe("PageAnalyzer", () => {
  let analyzer: PageAnalyzer;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  beforeEach(() => {
    analyzer = new PageAnalyzer(mockLogger as any);
  });

  describe("detectRenderMethod", () => {
    it("should detect Next.js SSR", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body><div id="__next"></div>__NEXT_DATA__</body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("server");
    });

    it("should detect Nuxt.js SSR", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>window.__NUXT__ = {};</body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("server");
    });

    it("should detect React client-side rendering", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body data-reactroot></body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("client");
    });

    it("should detect Vue client-side rendering", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body><div v-bind:id="id"></div></body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("client");
    });

    it("should detect Angular client-side rendering", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body ng-version="12.0.0"></body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("client");
    });

    it("should detect client rendering for minimal content pages", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body><div>short</div></body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("client");
    });

    it("should return unknown for pages with substantial content and no indicators", async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body><article><p>This is a long article with substantial content that would not be considered minimal.</p></article></body></html>')
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("unknown");
    });

    it("should handle errors and return unknown render method", async () => {
      const mockPage = {
        content: jest.fn().mockRejectedValue(new Error("Failed to get content"))
      };
      const result = await analyzer.detectRenderMethod(mockPage as any);
      expect(result).toBe("unknown");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[RenderMethod] Failed to detect render method: Failed to get content"
      );
    });
  });
});