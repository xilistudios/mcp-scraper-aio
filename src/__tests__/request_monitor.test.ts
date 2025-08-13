import { RequestMonitor } from "../services/request_monitor";
import { Logger } from "../logger";
import { config } from "../config";

// Mock the crypto module
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

describe("RequestMonitor", () => {
  let requestMonitor: RequestMonitor;
  let mockLogger: jest.Mocked<Logger>;
  let mockPage: any;
  let capturedRequests: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    requestMonitor = new RequestMonitor(mockLogger);
    capturedRequests = [];

    mockPage = {
      on: jest.fn(),
    };
  });

  describe("setupRequestMonitoring", () => {
    it("should set up request and response listeners", () => {
      requestMonitor.setupRequestMonitoring(mockPage, capturedRequests, false);

      expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith("response", expect.any(Function));
    });

    it("should filter out image requests when includeImages is false", () => {
      requestMonitor.setupRequestMonitoring(mockPage, capturedRequests, false);
      
      const requestHandler = mockPage.on.mock.calls[0][1]; // First call, second argument
      
      // Test image request
      const imageRequest = {
        url: () => "https://example.com/image.jpg",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "image",
      };
      
      requestHandler(imageRequest);
      expect(capturedRequests).toHaveLength(0);
      
      // Test document request
      const documentRequest = {
        url: () => "https://example.com/api/data",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "document",
      };
      
      requestHandler(documentRequest);
      expect(capturedRequests).toHaveLength(1);
    });

    it("should include image requests when includeImages is true", () => {
      requestMonitor.setupRequestMonitoring(mockPage, capturedRequests, true);
      
      const requestHandler = mockPage.on.mock.calls[0][1]; // First call, second argument
      
      const imageRequest = {
        url: () => "https://example.com/image.jpg",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "image",
      };
      
      requestHandler(imageRequest);
      expect(capturedRequests).toHaveLength(1);
    });
  });

  describe("response body capture", () => {
    let responseHandler: Function;

    beforeEach(() => {
      requestMonitor.setupRequestMonitoring(mockPage, capturedRequests, false);
      responseHandler = mockPage.on.mock.calls[1][1]; // Second call, second argument (response handler)
    });

    it("should capture response body for text-based content", async () => {
      // First add a request
      const requestHandler = mockPage.on.mock.calls[0][1];
      const mockRequest = {
        url: () => "https://example.com/api/data",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "xhr",
      };
      
      requestHandler(mockRequest);
      
      // Then handle the response
      const mockResponse = {
        url: () => "https://example.com/api/data",
        status: () => 200,
        headers: () => ({ "content-type": "application/json" }),
        text: jest.fn().mockResolvedValue('{"data": "test"}'),
      };
      
      await responseHandler(mockResponse);
      
      expect(capturedRequests[0].status).toBe(200);
      expect(capturedRequests[0].responseHeaders).toEqual({ "content-type": "application/json" });
      expect(capturedRequests[0].responseBody).toBe('{"data": "test"}');
    });

    it("should not capture response body for image content", async () => {
      // First add a request with includeImages set to true so the request is captured
      requestMonitor.setupRequestMonitoring(mockPage, capturedRequests, true);
      
      // Get the updated request and response handlers
      const requestHandler = mockPage.on.mock.calls[2][1]; // Third call (after re-setup), second argument
      const updatedResponseHandler = mockPage.on.mock.calls[3][1]; // Fourth call (after re-setup), second argument
      
      const mockRequest = {
        url: () => "https://example.com/image.jpg",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "image",
      };
      
      requestHandler(mockRequest);
      
      // Then handle the response
      const mockResponse = {
        url: () => "https://example.com/image.jpg",
        status: () => 200,
        headers: () => ({ "content-type": "image/jpeg" }),
        text: jest.fn().mockResolvedValue("binary-image-data"),
      };
      
      await updatedResponseHandler(mockResponse);
      
      expect(capturedRequests[0].status).toBe(200);
      expect(capturedRequests[0].responseHeaders).toEqual({ "content-type": "image/jpeg" });
      expect(capturedRequests[0].responseBody).toBeUndefined();
    });

    it("should handle response body capture errors gracefully", async () => {
      // First add a request
      const requestHandler = mockPage.on.mock.calls[0][1];
      const mockRequest = {
        url: () => "https://example.com/api/data",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "xhr",
      };
      
      requestHandler(mockRequest);
      
      // Then handle the response with an error
      const mockResponse = {
        url: () => "https://example.com/api/data",
        status: () => 200,
        headers: () => ({ "content-type": "application/json" }),
        text: jest.fn().mockRejectedValue(new Error("Failed to read response body")),
      };
      
      await responseHandler(mockResponse);
      
      expect(capturedRequests[0].status).toBe(200);
      expect(capturedRequests[0].responseHeaders).toEqual({ "content-type": "application/json" });
      expect(capturedRequests[0].responseBody).toBe("[Failed to capture response body]");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[Response] Failed to capture response body for https://example.com/api/data: Failed to read response body"
      );
    });
  });

  describe("response body truncation", () => {
    let responseHandler: Function;

    beforeEach(() => {
      requestMonitor.setupRequestMonitoring(mockPage, capturedRequests, false);
      responseHandler = mockPage.on.mock.calls[1][1]; // Second call, second argument (response handler)
    });

    it("should truncate response body when it exceeds size limit", async () => {
      // First add a request
      const requestHandler = mockPage.on.mock.calls[0][1];
      const mockRequest = {
        url: () => "https://example.com/large-data",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "xhr",
      };
      
      requestHandler(mockRequest);
      
      // Create a large response body that exceeds the limit
      const largeResponseBody = "a".repeat(config.limits.maxResponseBodySize + 1000);
      
      // Then handle the response
      const mockResponse = {
        url: () => "https://example.com/large-data",
        status: () => 200,
        headers: () => ({ "content-type": "application/json" }),
        text: jest.fn().mockResolvedValue(largeResponseBody),
      };
      
      await responseHandler(mockResponse);
      
      expect(capturedRequests[0].responseBody).toContain("... [Response body truncated - too large]");
      expect(capturedRequests[0].responseBody.length).toBeLessThan(largeResponseBody.length);
      expect(capturedRequests[0].responseBody.length).toBe(config.limits.maxResponseBodySize + "\n... [Response body truncated - too large]".length);
    });

    it("should not truncate response body when it is within size limit", async () => {
      // First add a request
      const requestHandler = mockPage.on.mock.calls[0][1];
      const mockRequest = {
        url: () => "https://example.com/small-data",
        method: () => "GET",
        headers: () => ({}),
        postData: () => null,
        resourceType: () => "xhr",
      };
      
      requestHandler(mockRequest);
      
      // Create a small response body that is within the limit
      const smallResponseBody = "a".repeat(config.limits.maxResponseBodySize - 1000);
      
      // Then handle the response
      const mockResponse = {
        url: () => "https://example.com/small-data",
        status: () => 200,
        headers: () => ({ "content-type": "application/json" }),
        text: jest.fn().mockResolvedValue(smallResponseBody),
      };
      
      await responseHandler(mockResponse);
      
      expect(capturedRequests[0].responseBody).toBe(smallResponseBody);
      expect(capturedRequests[0].responseBody).not.toContain("... [Response body truncated - too large]");
    });
  });
});