import { ReportGenerator } from "../services/report_generator";
import { type CapturedRequest, type SiteAnalysisResult } from "../types";

describe("ReportGenerator", () => {
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
  });

  describe("generateAnalysisResult", () => {
    const testUrl = "https://example.com";
    const testTitle = "Test Website";
    const testRenderMethod: "client" | "server" | "unknown" = "unknown";

    it("should generate a complete analysis result with minimal data", () => {
      const capturedRequests: CapturedRequest[] = [];
      
      const result = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        testRenderMethod
      );

      expect(result).toEqual({
        url: testUrl,
        title: testTitle,
        requests: [],
        totalRequests: 0,
        uniqueDomains: [],
        requestsByType: {},
        analysisTimestamp: expect.any(String),
        renderMethod: testRenderMethod,
        antiBotDetection: {
          detected: false
        },
        browserStorage: undefined
      });

      // Verify timestamp format
      expect(result.analysisTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should correctly count and categorize requests", () => {
      const capturedRequests: CapturedRequest[] = [
        {
          id: "1",
          url: "https://example.com/",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:00Z",
          status: 200,
          responseHeaders: {},
          resourceType: "document"
        },
        {
          id: "2",
          url: "https://example.com/style.css",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:01Z",
          status: 200,
          responseHeaders: {},
          resourceType: "stylesheet"
        },
        {
          id: "3",
          url: "https://example.com/script.js",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:02Z",
          status: 200,
          responseHeaders: {},
          resourceType: "script"
        },
        {
          id: "4",
          url: "https://api.example.com/data",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:03Z",
          status: 200,
          responseHeaders: {},
          resourceType: "xhr"
        },
        {
          id: "5",
          url: "https://example.com/image.png",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:04Z",
          status: 200,
          responseHeaders: {},
          resourceType: "image"
        },
        {
          id: "6",
          url: "https://example.com/script2.js",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:05Z",
          status: 200,
          responseHeaders: {},
          resourceType: "script"
        }
      ];

      const result = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        testRenderMethod
      );

      expect(result.totalRequests).toBe(6);
      expect(result.requests).toEqual(capturedRequests);
      expect(result.uniqueDomains).toEqual(["example.com", "api.example.com"]);
      expect(result.requestsByType).toEqual({
        document: 1,
        stylesheet: 1,
        script: 2,
        xhr: 1,
        image: 1
      });
    });

    it("should extract domains correctly including handling invalid URLs", () => {
      const capturedRequests: CapturedRequest[] = [
        {
          id: "1",
          url: "https://example.com/",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:00Z",
          status: 200,
          responseHeaders: {},
          resourceType: "document"
        },
        {
          id: "2",
          url: "invalid-url",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:01Z",
          status: 200,
          responseHeaders: {},
          resourceType: "document"
        },
        {
          id: "3",
          url: "https://subdomain.example.com/path",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:02Z",
          status: 200,
          responseHeaders: {},
          resourceType: "document"
        }
      ];

      const result = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        testRenderMethod
      );

      expect(result.uniqueDomains).toEqual(["example.com", "invalid-url", "subdomain.example.com"]);
    });

    it("should include browser storage data when provided", () => {
      const capturedRequests: CapturedRequest[] = [];
      const browserStorage: SiteAnalysisResult["browserStorage"] = {
        cookies: [{ name: "session_id", value: "abc123", domain: "example.com" } as any],
        localStorage: { "theme": "dark" },
        sessionStorage: { "temp_data": "temporary" }
      };

      const result = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        testRenderMethod,
        browserStorage
      );

      expect(result.browserStorage).toEqual(browserStorage);
    });

    it("should detect anti-bot systems through SecurityAnalyzer integration", () => {
      // Test case with captcha in title
      const capturedRequests: CapturedRequest[] = [];
      const result = reportGenerator.generateAnalysisResult(
        testUrl,
        "Please solve captcha now",
        capturedRequests,
        testRenderMethod
      );

      expect(result.antiBotDetection).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha indicated in page title"
      });

      // Test case with captcha domain in requests
      const capturedRequestsWithCaptcha: CapturedRequest[] = [
        {
          id: "1",
          url: "https://www.google.com/recaptcha/api.js",
          method: "GET",
          headers: {},
          timestamp: "2024-01-01T00:00:00Z",
          resourceType: "script"
        }
      ];

      const resultWithCaptcha = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequestsWithCaptcha,
        testRenderMethod
      );

      expect(resultWithCaptcha.antiBotDetection).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha detected from domain: www.google.com"
      });
    });

    it("should handle render method parameter correctly", () => {
      const capturedRequests: CapturedRequest[] = [];

      // Test server render method
      const serverResult = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        "server"
      );
      expect(serverResult.renderMethod).toBe("server");

      // Test client render method
      const clientResult = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        "client"
      );
      expect(clientResult.renderMethod).toBe("client");

      // Test unknown render method
      const unknownResult = reportGenerator.generateAnalysisResult(
        testUrl,
        testTitle,
        capturedRequests,
        "unknown"
      );
      expect(unknownResult.renderMethod).toBe("unknown");
    });
  });
});