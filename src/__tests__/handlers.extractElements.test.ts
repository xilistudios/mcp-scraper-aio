import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { MCPToolHandlers } from "../handlers.js";
import { InvalidUrlError } from "../errors.js";

describe("MCPToolHandlers - handleExtractHtmlElements", () => {
  let handlers: MCPToolHandlers;
  let mockAnalyzer: { extractHtmlElements: jest.Mock };
  let mockLogger: { info: jest.Mock; debug: jest.Mock; error: jest.Mock };

  const sampleUrl = "https://example.com";
  const sampleFilterType = "text";

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockAnalyzer = {
      extractHtmlElements: jest.fn(),
    };

    handlers = new MCPToolHandlers(mockAnalyzer as any, mockLogger as any);
  });

  it("successfully extracts elements and returns formatted content", async () => {
    const elements = [
      { tag: "p", content: "Hello world" },
      { tag: "h1", content: "Title" },
    ];

    mockAnalyzer.extractHtmlElements.mockResolvedValue(elements);

    const result: any = await handlers.handleExtractHtmlElements({ url: sampleUrl, filterType: sampleFilterType });

    expect(mockAnalyzer.extractHtmlElements).toHaveBeenCalledWith(sampleUrl, sampleFilterType);
    expect(result).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(JSON.stringify(elements, null, 2));
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it("rejects with McpError InvalidParams for invalid input", async () => {
    const invalidParams = { url: "not-a-url", filterType: "text" };

    await expect(handlers.handleExtractHtmlElements(invalidParams)).rejects.toThrow(McpError);
    await expect(handlers.handleExtractHtmlElements(invalidParams)).rejects.toHaveProperty("code", ErrorCode.InvalidParams);
  });

  it("maps analyzer InvalidUrlError to McpError InvalidParams", async () => {
    mockAnalyzer.extractHtmlElements.mockRejectedValue(new InvalidUrlError("Invalid URL"));

    await expect(handlers.handleExtractHtmlElements({ url: sampleUrl, filterType: sampleFilterType })).rejects.toThrow(McpError);
    await expect(handlers.handleExtractHtmlElements({ url: sampleUrl, filterType: sampleFilterType })).rejects.toHaveProperty(
      "code",
      ErrorCode.InvalidParams
    );
  });

  it("maps generic analyzer errors to McpError InternalError", async () => {
    mockAnalyzer.extractHtmlElements.mockRejectedValue(new Error("boom"));

    await expect(handlers.handleExtractHtmlElements({ url: sampleUrl, filterType: sampleFilterType })).rejects.toThrow(McpError);
    await expect(handlers.handleExtractHtmlElements({ url: sampleUrl, filterType: sampleFilterType })).rejects.toHaveProperty(
      "code",
      ErrorCode.InternalError
    );
  });
});