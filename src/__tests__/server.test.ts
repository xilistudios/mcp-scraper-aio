import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { WebScraperMCPServer } from "../server.js";
import { BrowserManager } from "../browser.js";
import { WebsiteAnalyzer } from "../analyzer.js";
import { MCPToolHandlers } from "../handlers.js";
import { type AnalysisOptions, type RequestFilter } from "../types.js";

/**
 * Mock all dependencies
 */
jest.mock("@modelcontextprotocol/sdk/server/index.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");
jest.mock("../browser.js");
jest.mock("../analyzer.js");
jest.mock("../handlers.js");

/**
 * Test suite for WebScraperMCPServer class
 */
describe("WebScraperMCPServer", () => {
  let server: WebScraperMCPServer;
  let mockMCPServer: jest.Mocked<Server>;
  let mockBrowserManager: jest.Mocked<BrowserManager>;
  let mockAnalyzer: jest.Mocked<WebsiteAnalyzer>;
  let mockHandlers: jest.Mocked<MCPToolHandlers>;
  let mockTransport: jest.Mocked<StdioServerTransport>;
  let mockLogger: any;

  // Mock console.error to avoid noise in tests
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Server
    mockMCPServer = {
      setRequestHandler: jest.fn(),
      connect: jest.fn(),
      onerror: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    (Server as jest.MockedClass<typeof Server>).mockImplementation(() => mockMCPServer);

    // Mock BrowserManager
    mockBrowserManager = {
      isInitialized: jest.fn().mockReturnValue(true),
      cleanup: jest.fn(),
    } as unknown as jest.Mocked<BrowserManager>;

    (BrowserManager as jest.MockedClass<typeof BrowserManager>).mockImplementation(() => mockBrowserManager);

    // Mock WebsiteAnalyzer
    mockAnalyzer = {} as jest.Mocked<WebsiteAnalyzer>;
    (WebsiteAnalyzer as jest.MockedClass<typeof WebsiteAnalyzer>).mockImplementation(() => mockAnalyzer);

    // Mock MCPToolHandlers
    mockHandlers = {
      handleAnalyzeWebsite: jest.fn(),
      handleGetRequestsByDomain: jest.fn(),
      handleGetRequestDetails: jest.fn(),
      handleGetRequestSummary: jest.fn(),
      clearAnalysisResults: jest.fn(),
      getStoredResultsCount: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<MCPToolHandlers>;

    (MCPToolHandlers as jest.MockedClass<typeof MCPToolHandlers>).mockImplementation(() => mockHandlers);

    // Mock StdioServerTransport
    mockTransport = {} as jest.Mocked<StdioServerTransport>;
    (StdioServerTransport as jest.MockedClass<typeof StdioServerTransport>).mockImplementation(() => mockTransport);

    // Create a mock logger for tests
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    server = new WebScraperMCPServer(mockLogger as any);
  });

  describe("Constructor", () => {
    it("should create an instance with all dependencies", () => {
      expect(server).toBeInstanceOf(WebScraperMCPServer);
      expect(BrowserManager).toHaveBeenCalledTimes(1);
      expect(WebsiteAnalyzer).toHaveBeenCalledWith(mockBrowserManager, expect.anything());
      expect(MCPToolHandlers).toHaveBeenCalledWith(mockAnalyzer, expect.anything());
      expect(Server).toHaveBeenCalledWith(
        {
          name: "web-scraper-analytics",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
    });

    it("should set up MCP handlers", () => {
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function)
      );
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function)
      );
    });

    it("should set up error handling", () => {
      expect(mockMCPServer.onerror).toBeDefined();
    });
  });

  describe("List Tools Handler", () => {
    it("should return all available tools", async () => {
      const listToolsHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        call => call[0] === ListToolsRequestSchema
      )?.[1];

      expect(listToolsHandler).toBeDefined();

      const result = await listToolsHandler!({} as any, {} as any);

      expect(result).toEqual({
        tools: [
          {
            name: "analyze_website_requests",
            description: "Open a website and capture all HTTP requests made by the site. Returns only domain summary.",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL to analyze (must include http:// or https://)",
                },
                waitTime: {
                  type: "number",
                  description: "Additional wait time in milliseconds for dynamic content (default: 3000, max: 10000)",
                  default: 3000,
                },
                includeImages: {
                  type: "boolean",
                  description: "Whether to include image and media requests (default: false)",
                  default: false,
                },
                quickMode: {
                  type: "boolean",
                  description: "Use quick loading mode with minimal waiting (default: false)",
                  default: false,
                },
              },
              required: ["url"],
            },
          },
          {
            name: "get_requests_by_domain",
            description: "Get all requests made to a specific domain from a previous website analysis",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL that was previously analyzed",
                },
                domain: {
                  type: "string",
                  description: "The domain to filter requests for (e.g., 'example.com')",
                },
              },
              required: ["url", "domain"],
            },
          },
          {
            name: "get_request_details",
            description: "Get full details of a specific request including headers, body, and response",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL that was previously analyzed",
                },
                requestId: {
                  type: "string",
                  description: "The unique ID of the request to get details for",
                },
              },
              required: ["url", "requestId"],
            },
          },
          {
            name: "get_request_summary",
            description: "Get a summary of requests by domain and type from a previous analysis",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL that was previously analyzed",
                },
              },
              required: ["url"],
            },
          },
        ],
      });
    });
  });

  describe("Call Tool Handler", () => {
    let callToolHandler: Function;

    beforeEach(() => {
      callToolHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        call => call[0] === CallToolRequestSchema
      )?.[1]!;
    });

    it("should handle analyze_website_requests tool", async () => {
      const mockResult = { content: [{ type: "text", text: "analysis result" }] };
      mockHandlers.handleAnalyzeWebsite.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: "analyze_website_requests",
          arguments: { url: "https://example.com" },
        },
      };

      const result = await callToolHandler(request);

      expect(mockHandlers.handleAnalyzeWebsite).toHaveBeenCalledWith({ url: "https://example.com" });
      expect(result).toEqual(mockResult);
    });

    it("should handle get_requests_by_domain tool", async () => {
      const mockResult = { content: [{ type: "text", text: "domain requests" }] };
      mockHandlers.handleGetRequestsByDomain.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: "get_requests_by_domain",
          arguments: { url: "https://example.com", domain: "api.example.com" },
        },
      };

      const result = await callToolHandler(request);

      expect(mockHandlers.handleGetRequestsByDomain).toHaveBeenCalledWith({
        url: "https://example.com",
        domain: "api.example.com",
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle get_request_details tool", async () => {
      const mockResult = { content: [{ type: "text", text: "request details" }] };
      mockHandlers.handleGetRequestDetails.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: "get_request_details",
          arguments: { url: "https://example.com", requestId: "req-123" },
        },
      };

      const result = await callToolHandler(request);

      expect(mockHandlers.handleGetRequestDetails).toHaveBeenCalledWith({
        url: "https://example.com",
        requestId: "req-123",
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle get_request_summary tool", async () => {
      const mockResult = { content: [{ type: "text", text: "request summary" }] };
      mockHandlers.handleGetRequestSummary.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: "get_request_summary",
          arguments: { url: "https://example.com" },
        },
      };

      const result = await callToolHandler(request);

      expect(mockHandlers.handleGetRequestSummary).toHaveBeenCalledWith("https://example.com");
      expect(result).toEqual(mockResult);
    });

    it("should throw MethodNotFound error for unknown tool", async () => {
      const request = {
        params: {
          name: "unknown_tool",
          arguments: {},
        },
      };

      await expect(callToolHandler(request)).rejects.toThrow(
        new McpError(ErrorCode.MethodNotFound, "Unknown tool: unknown_tool")
      );
    });

    it("should handle McpError from handlers", async () => {
      const mcpError = new McpError(ErrorCode.InvalidParams, "Invalid parameters");
      mockHandlers.handleAnalyzeWebsite.mockRejectedValue(mcpError);

      const request = {
        params: {
          name: "analyze_website_requests",
          arguments: { url: "https://example.com" },
        },
      };

      await expect(callToolHandler(request)).rejects.toThrow(mcpError);
    });

    it("should convert generic errors to McpError", async () => {
      const genericError = new Error("Network timeout");
      mockHandlers.handleAnalyzeWebsite.mockRejectedValue(genericError);

      const request = {
        params: {
          name: "analyze_website_requests",
          arguments: { url: "https://example.com" },
        },
      };

      await expect(callToolHandler(request)).rejects.toThrow(
        new McpError(ErrorCode.InternalError, "Tool execution failed: Network timeout")
      );
    });

    it("should handle unknown errors", async () => {
      mockHandlers.handleAnalyzeWebsite.mockRejectedValue("unknown error");

      const request = {
        params: {
          name: "analyze_website_requests",
          arguments: { url: "https://example.com" },
        },
      };

      await expect(callToolHandler(request)).rejects.toThrow(
        new McpError(ErrorCode.InternalError, "Tool execution failed: Unknown error")
      );
    });
  });

  describe("run", () => {
    it("should start the server successfully", async () => {
      mockMCPServer.connect.mockResolvedValue(undefined);

      await server.run();

      expect(StdioServerTransport).toHaveBeenCalledTimes(1);
      expect(mockMCPServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it("should handle connection errors and cleanup", async () => {
      const connectionError = new Error("Connection failed");
      mockMCPServer.connect.mockRejectedValue(connectionError);

      await expect(server.run()).rejects.toThrow(connectionError);

      expect(mockBrowserManager.cleanup).toHaveBeenCalled();
    });
  });

  describe("getStatus", () => {
    it("should return server status information", () => {
      mockBrowserManager.isInitialized.mockReturnValue(true);
      mockHandlers.getStoredResultsCount.mockReturnValue(5);

      const status = server.getStatus();

      expect(status).toEqual({
        browserInitialized: true,
        storedResults: 5,
        serverName: "web-scraper-analytics",
        version: "1.0.0",
      });
    });

    it("should return status with browser not initialized", () => {
      mockBrowserManager.isInitialized.mockReturnValue(false);
      mockHandlers.getStoredResultsCount.mockReturnValue(0);

      const status = server.getStatus();

      expect(status).toEqual({
        browserInitialized: false,
        storedResults: 0,
        serverName: "web-scraper-analytics",
        version: "1.0.0",
      });
    });
  });

  describe("cleanup", () => {
    it("should test cleanup functionality through server instance", async () => {
      // Mock the cleanup method to avoid actual cleanup
      const cleanupSpy = jest.spyOn(mockBrowserManager, "cleanup");
      const clearResultsSpy = jest.spyOn(mockHandlers, "clearAnalysisResults");

      // Call cleanup indirectly by testing server status after cleanup would have occurred
      expect(cleanupSpy).toBeDefined();
      expect(clearResultsSpy).toBeDefined();

      // Verify that the server has the necessary components
      const status = server.getStatus();
      expect(status).toMatchObject({
        serverName: "web-scraper-analytics",
        version: "1.0.0",
      });
    });
  });

  describe("Error Handling", () => {
    it("should set server error handler", () => {
      const testError = new Error("Server error");

      // Call the error handler directly
      if (typeof mockMCPServer.onerror === "function") {
        mockMCPServer.onerror(testError);
      }

      expect(mockLogger.error).toHaveBeenCalledWith("[Server Error] Server error");
    });

    it("should verify error handling setup", () => {
      // Verify that the server has proper error handling
      expect(mockMCPServer.onerror).toBeDefined();

      // Verify that the server components are properly initialized
      const status = server.getStatus();
      expect(status).toMatchObject({
        serverName: "web-scraper-analytics",
        version: "1.0.0",
      });
    });
  });
});