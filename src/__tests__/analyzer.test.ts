import { WebsiteAnalyzer } from "../analyzer";
import { BrowserManager } from "../browser";
import { type CapturedRequest, type SiteAnalysisResult, type AnalysisOptions } from "../types";
import { InvalidUrlError, AnalysisTimeoutError } from "../errors";
import { RequestMonitor } from "../services/request_monitor";
import { PageAnalyzer } from "../services/page_analyzer";
import { StorageCapturer } from "../services/storage_capturer";
import { ReportGenerator } from "../services/report_generator";

/**
 * Mock the crypto module
 */
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

/**
 * Mock the browser manager completely
 */
jest.mock("../browser", () => ({
  BrowserManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    getContext: jest.fn(),
    isInitialized: jest.fn(),
    cleanup: jest.fn(),
  })),
}));

/**
 * Mock the service modules
 */
jest.mock("../services/request_monitor", () => ({
  RequestMonitor: jest.fn().mockImplementation(() => ({
    setupRequestMonitoring: jest.fn((page, capturedRequests, includeImages) => {
      // Simulate the actual setupRequestMonitoring by adding event listeners
      page.on("request", expect.any(Function));
      page.on("response", expect.any(Function));
    }),
  })),
}));

jest.mock("../services/page_analyzer", () => ({
  PageAnalyzer: jest.fn().mockImplementation(() => ({
    detectRenderMethod: jest.fn().mockResolvedValue("unknown"),
  })),
}));

jest.mock("../services/storage_capturer", () => ({
  StorageCapturer: jest.fn().mockImplementation(() => ({
    captureBrowserStorage: jest.fn().mockResolvedValue({
      cookies: [],
      localStorage: {},
      sessionStorage: {},
    }),
  })),
}));

jest.mock("../services/report_generator", () => ({
  ReportGenerator: jest.fn().mockImplementation(() => ({
    generateAnalysisResult: jest.fn().mockImplementation((
      url: string,
      title: string,
      capturedRequests: any[],
      renderMethod: string,
      browserStorage?: any
    ) => ({
      url,
      title,
      requests: capturedRequests,
      totalRequests: capturedRequests.length,
      uniqueDomains: [],
      requestsByType: {},
      analysisTimestamp: new Date().toISOString(),
      renderMethod: renderMethod || "unknown",
      antiBotDetection: {
        detected: false,
      },
      browserStorage: browserStorage || {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      },
    })),
  })),
}));

/**
 * Test suite for WebsiteAnalyzer class (orchestrator functionality)
 */
describe("WebsiteAnalyzer (Orchestrator)", () => {
  let analyzer: WebsiteAnalyzer;
  let mockBrowserManager: jest.Mocked<BrowserManager>;
  let mockPage: any;
  let mockContext: any;
  let mockLogger: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up mock page with all required methods
    mockPage = {
      goto: jest.fn(),
      title: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      waitForLoadState: jest.fn(),
      waitForTimeout: jest.fn(),
      context: jest.fn(() => ({
        cookies: jest.fn(() => Promise.resolve([])),
      })),
      evaluate: jest.fn(() => Promise.resolve({})),
    };

    // Set up mock context
    mockContext = {
      newPage: jest.fn(() => Promise.resolve(mockPage)),
    };

    // Set up mock browser manager
    mockBrowserManager = {
      initialize: jest.fn(),
      getContext: jest.fn(() => mockContext),
      isInitialized: jest.fn(),
      cleanup: jest.fn(),
    } as unknown as jest.Mocked<BrowserManager>;

    // Create a mock logger for tests
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Create analyzer instance
    analyzer = new WebsiteAnalyzer(mockBrowserManager, mockLogger as any);

    // Set up default successful behavior
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.title.mockResolvedValue("Test Page Title");
    mockPage.close.mockResolvedValue(undefined);
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.waitForTimeout.mockResolvedValue(undefined);
    mockBrowserManager.initialize.mockResolvedValue(undefined);
  });

  describe("analyzeWebsite", () => {
    const validOptions: AnalysisOptions = {
      url: "https://example.com",
      waitTime: 3000,
      includeImages: false,
      quickMode: false,
    };

    it("should successfully analyze a website with default options", async () => {
      const result: SiteAnalysisResult = await analyzer.analyzeWebsite(validOptions);

      expect(result).toEqual({
        url: "https://example.com",
        title: "Test Page Title",
        requests: [],
        totalRequests: 0,
        uniqueDomains: [],
        requestsByType: {},
        analysisTimestamp: expect.any(String),
        renderMethod: "unknown",
        antiBotDetection: {
          detected: false,
        },
        browserStorage: {
          cookies: [],
          localStorage: {},
          sessionStorage: {},
        },
      });

      expect(mockBrowserManager.initialize).toHaveBeenCalledTimes(1);
      expect(mockContext.newPage).toHaveBeenCalledTimes(1);
      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      expect(mockPage.title).toHaveBeenCalledTimes(1);
      expect(mockPage.close).toHaveBeenCalledTimes(1);
    });

    it("should throw error for invalid URL", async () => {
      const invalidOptions = { ...validOptions, url: "invalid-url" };

      await expect(analyzer.analyzeWebsite(invalidOptions)).rejects.toThrow(
        "Invalid URL provided. Please include http:// or https://"
      );

      expect(mockBrowserManager.initialize).not.toHaveBeenCalled();
    });

    it("should throw InvalidUrlError for invalid URL", async () => {
      const invalidOptions = { ...validOptions, url: "invalid-url" };
      
      await expect(analyzer.analyzeWebsite(invalidOptions)).rejects.toThrow(InvalidUrlError);
      await expect(analyzer.analyzeWebsite(invalidOptions)).rejects.toThrow(
        "Invalid URL provided. Please include http:// or https://"
      );
      
      expect(mockBrowserManager.initialize).not.toHaveBeenCalled();
    });

    it("should handle quick mode correctly", async () => {
      const quickModeOptions = { ...validOptions, quickMode: true };

      await analyzer.analyzeWebsite(quickModeOptions);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
    });

    it("should respect custom wait time", async () => {
      const customWaitOptions = { ...validOptions, waitTime: 5000 };

      await analyzer.analyzeWebsite(customWaitOptions);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(5000);
    });

    it("should cap wait time at 10000ms", async () => {
      const longWaitOptions = { ...validOptions, waitTime: 15000 };

      await analyzer.analyzeWebsite(longWaitOptions);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(10000);
    });

    it("should handle navigation errors", async () => {
      const navigationError = new Error("Navigation failed");
      mockPage.goto.mockRejectedValue(navigationError);

      await expect(analyzer.analyzeWebsite(validOptions)).rejects.toThrow(
        "Failed to analyze website: Navigation failed"
      );

      expect(mockPage.close).toHaveBeenCalledTimes(1);
    });

    it("should handle timeout errors specifically", async () => {
      const timeoutError = new Error("timeout occurred");
      mockPage.goto.mockRejectedValue(timeoutError);
      
      await expect(analyzer.analyzeWebsite(validOptions)).rejects.toThrow(AnalysisTimeoutError);
      
      expect(mockPage.close).toHaveBeenCalledTimes(1);
    });

    it("should handle network idle timeout gracefully", async () => {
      mockPage.waitForLoadState.mockRejectedValue(new Error("Timeout"));

      const result = await analyzer.analyzeWebsite(validOptions);

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[Wait] Network idle timeout reached, continuing with analysis..."
      );
    });

    it("should set up request monitoring through RequestMonitor service", async () => {
      await analyzer.analyzeWebsite(validOptions);

      expect(RequestMonitor).toHaveBeenCalledTimes(1);
      // Verify that the setupRequestMonitoring method would be called
      expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith("response", expect.any(Function));
    });

    it("should handle page creation failure", async () => {
      mockContext.newPage.mockRejectedValue(new Error("Failed to create page"));

      await expect(analyzer.analyzeWebsite({
        url: "https://example.com",
      })).rejects.toThrow("Failed to create page");
    });

    it("should handle browser initialization failure", async () => {
      mockBrowserManager.initialize.mockRejectedValue(new Error("Browser init failed"));

      await expect(analyzer.analyzeWebsite({
        url: "https://example.com",
      })).rejects.toThrow("Browser init failed");
    });

    it("should handle non-Error exceptions", async () => {
      mockPage.goto.mockRejectedValue("String error");

      await expect(analyzer.analyzeWebsite({
        url: "https://example.com",
      })).rejects.toBe("String error");
    });
  });

  describe("analysis result structure", () => {
    it("should generate correct analysis result structure", async () => {
      const options: AnalysisOptions = {
        url: "https://example.com",
        waitTime: 0, // Minimize wait time for testing
      };

      const result = await analyzer.analyzeWebsite(options);

      expect(result.url).toBe("https://example.com");
      expect(result.title).toBe("Test Page Title");
      expect(result.analysisTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(typeof result.totalRequests).toBe("number");
      expect(Array.isArray(result.uniqueDomains)).toBe(true);
      expect(typeof result.requestsByType).toBe("object");
      expect(Array.isArray(result.requests)).toBe(true);
      expect(typeof result.renderMethod).toBe("string");
      expect(typeof result.antiBotDetection).toBe("object");
      expect(typeof result.browserStorage).toBe("object");
    });

    it("should handle minimal options", async () => {
      const minimalOptions: AnalysisOptions = {
        url: "https://example.com",
      };

      const result = await analyzer.analyzeWebsite(minimalOptions);

      expect(result).toBeDefined();
      expect(result.url).toBe("https://example.com");
    });
  });

  describe("logging", () => {
    it("should log appropriate messages during analysis", async () => {
      await analyzer.analyzeWebsite({
        url: "https://example.com",
        waitTime: 1000,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[Setup] Setting up request monitoring for https://example.com"
      );
      expect(mockLogger.info).toHaveBeenCalledWith("[Navigation] Loading https://example.com...");
      expect(mockLogger.info).toHaveBeenCalledWith("[Wait] Waiting 1000ms for additional requests...");
    });
  });

  describe("edge cases", () => {
    it("should handle zero wait time", async () => {
      await analyzer.analyzeWebsite({
        url: "https://example.com",
        waitTime: 0,
      });

      expect(mockPage.waitForTimeout).not.toHaveBeenCalled();
    });

    it("should handle includeImages option", async () => {
      await analyzer.analyzeWebsite({
        url: "https://example.com",
        includeImages: true,
      });

      expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));
    });

    it("should handle URL with different protocols", async () => {
      const httpsResult = await analyzer.analyzeWebsite({
        url: "https://secure.example.com",
      });

      const httpResult = await analyzer.analyzeWebsite({
        url: "http://example.com",
      });

      expect(httpsResult.url).toBe("https://secure.example.com");
      expect(httpResult.url).toBe("http://example.com");
    });
  });
});