import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { MCPToolHandlers } from "../handlers.js";
import { WebsiteAnalyzer } from "../analyzer.js";
import {
  type SiteAnalysisResult,
  type AnalysisOptions,
  type RequestFilter,
  type CapturedRequest,
} from "../types.js";

/**
 * Mock the WebsiteAnalyzer class
 */
jest.mock("../analyzer", () => ({
  WebsiteAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeWebsite: jest.fn(),
  })),
}));

/**
 * Test suite for MCPToolHandlers class
 */
describe("MCPToolHandlers", () => {
  let handlers: MCPToolHandlers;
  let mockAnalyzer: jest.Mocked<WebsiteAnalyzer>;

  // Sample test data
  const sampleUrl = "https://example.com";
  const sampleDomain = "api.example.com";
  const sampleRequestId = "req-123";

  const sampleRequest: CapturedRequest = {
    id: sampleRequestId,
    url: `https://${sampleDomain}/api/data`,
    method: "GET",
    headers: { "user-agent": "test-agent" },
    timestamp: "2024-01-01T12:00:00Z",
    status: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: '{"data": "test"}',
    resourceType: "xhr",
  };

  const sampleAnalysisResult: SiteAnalysisResult = {
    url: sampleUrl,
    title: "Test Website",
    requests: [sampleRequest],
    totalRequests: 1,
    uniqueDomains: [sampleDomain],
    requestsByType: { xhr: 1 },
    analysisTimestamp: "2024-01-01T12:00:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock analyzer
    mockAnalyzer = {
      analyzeWebsite: jest.fn(),
    } as unknown as jest.Mocked<WebsiteAnalyzer>;

    // Create handlers instance
    handlers = new MCPToolHandlers(mockAnalyzer);
  });

  it("should create an instance", () => {
    expect(handlers).toBeInstanceOf(MCPToolHandlers);
    expect(handlers.getStoredResultsCount()).toBe(0);
  });

  describe("handleAnalyzeWebsite", () => {
    const validOptions: AnalysisOptions = {
      url: sampleUrl,
      waitTime: 3000,
      includeImages: false,
      quickMode: false,
    };

    it("should successfully analyze a website with valid options", async () => {
      mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
      const result = await handlers.handleAnalyzeWebsite(validOptions);

      expect(mockAnalyzer.analyzeWebsite).toHaveBeenCalledWith(validOptions);
      expect(result.content[0].type).toBe("text");

      const summary = JSON.parse(result.content[0].text);
      expect(summary.websiteInfo.url).toBe(sampleUrl);
      expect(summary.requestSummary.totalRequests).toBe(1);
    });

    it("should throw McpError for invalid URL", async () => {
      const invalidOptions = { url: "invalid-url" };

      await expect(handlers.handleAnalyzeWebsite(invalidOptions)).rejects.toThrow(
        new McpError(ErrorCode.InvalidParams, "Invalid URL provided. Please include http:// or https://")
      );
    });

    it("should handle analyzer errors", async () => {
      mockAnalyzer.analyzeWebsite.mockRejectedValue(new Error("Network timeout"));

      await expect(handlers.handleAnalyzeWebsite(validOptions)).rejects.toThrow(
        new McpError(ErrorCode.InternalError, "Network timeout")
      );
    });

    it("should handle quick mode correctly", async () => {
      const quickModeOptions = { ...validOptions, quickMode: true };
      mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);

      await handlers.handleAnalyzeWebsite(quickModeOptions);

      expect(mockAnalyzer.analyzeWebsite).toHaveBeenCalledWith({
        url: sampleUrl,
        waitTime: 1000, // Should use 1000ms for quick mode
        includeImages: false,
        quickMode: true,
      });
    });

    it("should use default values for optional parameters", async () => {
      const minimalOptions = { url: sampleUrl };
      mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);

      await handlers.handleAnalyzeWebsite(minimalOptions);

      expect(mockAnalyzer.analyzeWebsite).toHaveBeenCalledWith({
        url: sampleUrl,
        waitTime: 3000, // Default value
        includeImages: false, // Default value
        quickMode: false, // Default value
      });
    });
  });

  describe("handleGetRequestsByDomain", () => {
    beforeEach(async () => {
      mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
      await handlers.handleAnalyzeWebsite({ url: sampleUrl });
    });

    it("should filter requests by domain", async () => {
      const result = await handlers.handleGetRequestsByDomain({
        url: sampleUrl,
        domain: sampleDomain,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.totalRequests).toBe(1);
      expect(data.domain).toBe(sampleDomain);
    });

    it("should throw error when domain not provided", async () => {
      await expect(handlers.handleGetRequestsByDomain({ url: sampleUrl })).rejects.toThrow(
        new McpError(ErrorCode.InvalidParams, "Domain parameter is required")
      );
    });
  });

  describe("handleGetRequestDetails", () => {
    beforeEach(async () => {
      mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
      await handlers.handleAnalyzeWebsite({ url: sampleUrl });
    });

    it("should retrieve request details by ID", async () => {
      const result = await handlers.handleGetRequestDetails({
        url: sampleUrl,
        requestId: sampleRequestId,
      });

      const details = JSON.parse(result.content[0].text);
      expect(details.id).toBe(sampleRequestId);
      expect(details.responseBody).toBe('{"data": "test"}');
    });

    it("should throw error when request ID not provided", async () => {
      await expect(handlers.handleGetRequestDetails({ url: sampleUrl })).rejects.toThrow(
        new McpError(ErrorCode.InvalidParams, "Request ID parameter is required")
      );
    });
  });

  describe("Memory management", () => {
    it("should clear analysis results", async () => {
      expect(handlers.getStoredResultsCount()).toBe(0);

      mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
      await handlers.handleAnalyzeWebsite({ url: sampleUrl });
      expect(handlers.getStoredResultsCount()).toBe(1);

      handlers.clearAnalysisResults();
      expect(handlers.getStoredResultsCount()).toBe(0);
    });
  });
});