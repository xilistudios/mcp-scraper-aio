import { WebsiteAnalyzer } from "../analyzer";

describe("WebsiteAnalyzer.detectRenderMethod", () => {
  it("detects Next.js server rendering when __NEXT_DATA__ is present", async () => {
    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>content</body>__NEXT_DATA__</html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("server");
  });

  it("detects Nuxt.js server rendering when window.__NUXT__ is present", async () => {
    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>content</body>window.__NUXT__ = {};</html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("server");
  });

  it("detects React client rendering when React hydration markers are present", async () => {
    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body data-reactroot>content</body></html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("client");
  });

  it("detects Vue client rendering when Vue hydration markers are present", async () => {
    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>content</body><div v-bind></div></html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("client");
  });

  it("detects client rendering for minimal content in body", async () => {
    const mockPage: any = {
      content: jest.fn().mockResolvedValue("<html><body>short</body></html>")
    };
    const analyzer = new WebsiteAnalyzer({} as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("client");
  });

  it("handles errors and returns unknown render method", async () => {
    const mockPage: any = {
      content: jest.fn().mockRejectedValue(new Error("boom"))
    };
    const analyzer = new WebsiteAnalyzer({} as any);
    const result = await (analyzer as any).detectRenderMethod(mockPage);
    expect(result).toBe("unknown");
  });
});