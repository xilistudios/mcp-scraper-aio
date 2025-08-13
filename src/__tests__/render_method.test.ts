import { WebsiteAnalyzer } from "../analyzer";

describe("WebsiteAnalyzer.detectRenderMethod", () => {
  it("detects Next.js server rendering when __NEXT_DATA__ is present", async () => {
    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>content</body>__NEXT_DATA__</html>")
    };
    // Create a mock logger for tests
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const analyzer = new WebsiteAnalyzer({} as any, mockLogger as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("server");
  });

  it("detects Nuxt.js server rendering when window.__NUXT__ is present", async () => {
    // Create a mock logger for tests
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>content</body>window.__NUXT__ = {};</html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any, mockLogger as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("server");
  });

  it("detects React client rendering when React hydration markers are present", async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body data-reactroot>content</body></html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any, mockLogger as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("client");
  });

  it("detects Vue client rendering when Vue hydration markers are present", async () => {
    // Create a mock logger for tests
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>content</body><div v-bind></div></html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any, mockLogger as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("client");
  });

  it("detects client rendering for minimal content in body", async () => {
    // Create a mock logger for tests
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>short</body></html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any, mockLogger as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("client");
  });

  it("handles errors and returns unknown render method", async () => {
    // Create a mock logger for tests
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockPage: any = {
      content: jest.fn().mockRejectedValue(new Error("boom"))
    };
    const analyzer = new WebsiteAnalyzer({} as any, mockLogger as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("unknown");
  });
});