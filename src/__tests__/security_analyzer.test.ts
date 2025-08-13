import { SecurityAnalyzer } from "../services/security_analyzer";

describe("SecurityAnalyzer", () => {
  let securityAnalyzer: SecurityAnalyzer;

  beforeEach(() => {
    securityAnalyzer = new SecurityAnalyzer();
  });

  describe("detectAntiBotSystems", () => {
    it("should detect captcha from request URL", () => {
      const capturedRequests = [
        { url: "https://www.google.com/recaptcha/api.js" } as any
      ];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Test Page");
      expect(result).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha detected from domain: www.google.com",
      });
    });

    it("should detect rate-limiting from response status", () => {
      const capturedRequests = [
        {
          url: "https://example.com/api",
          status: 429,
          responseHeaders: { "content-type": "application/json" },
          resourceType: "xhr",
        } as any
      ];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Test Page");
      expect(result).toEqual({
        detected: true,
        type: "rate-limiting",
        details: "Rate limiting detected with status code: 429",
      });
    });

    it("should detect rate-limiting from response headers", () => {
      const capturedRequests = [
        {
          url: "https://example.com/api",
          status: 200,
          responseHeaders: { "x-ratelimit-limit": "100" },
          resourceType: "xhr",
        } as any
      ];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Test Page");
      expect(result).toEqual({
        detected: true,
        type: "rate-limiting",
        details: "Rate limiting detected with status code: 200",
      });
    });

    it("should detect anti-bot service in requests by domain", () => {
      const capturedRequests = [
        { url: "https://cloudflare.com/js/anti-bot.js" } as any
      ];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Normal Page");
      expect(result).toEqual({
        detected: true,
        type: "behavioral-analysis",
        details: "Anti-bot service detected from domain: cloudflare.com",
      });
    });

    it("should detect captcha via page title", () => {
      const capturedRequests: any[] = [];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Please solve captcha now");
      expect(result).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha indicated in page title",
      });
    });

    it("should detect security check in page title", () => {
      const capturedRequests: any[] = [];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Security Check Required");
      expect(result).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha indicated in page title",
      });
    });

    it("should detect robot check in page title", () => {
      const capturedRequests: any[] = [];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Are you a robot?");
      expect(result).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha indicated in page title",
      });
    });

    it("returns no anti-bot detection when nothing detected", () => {
      const capturedRequests = [
        { url: "https://example.com/api/data", resourceType: "xhr" } as any
      ];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Normal Title");
      expect(result).toEqual({ detected: false });
    });

    it("should handle empty requests array", () => {
      const capturedRequests: any[] = [];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Normal Title");
      expect(result).toEqual({ detected: false });
    });

    it("should handle requests with missing properties", () => {
      const capturedRequests = [
        { url: "https://example.com/api/data" } as any, // Missing status and responseHeaders
        { url: "https://www.google.com/recaptcha/api.js" } as any // Captcha request
      ];
      const result = securityAnalyzer.detectAntiBotSystems(capturedRequests, "Normal Title");
      expect(result).toEqual({
        detected: true,
        type: "captcha",
        details: "Captcha detected from domain: www.google.com",
      });
    });
  });
});