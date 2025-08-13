import { BrowserManager } from "../browser";
import { chromium } from "patchright";
import type { Browser, BrowserContext } from "patchright";

/**
 * Mock the patchright module
 */
jest.mock("patchright", () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

/**
 * Test suite for BrowserManager class
 */
describe("BrowserManager", () => {
  let browserManager: BrowserManager;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockLogger: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock browser context
    mockContext = {
      close: jest.fn(),
    } as unknown as jest.Mocked<BrowserContext>;

    // Create mock browser
    mockBrowser = {
      newContext: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<Browser>;

    // Set up default successful behavior
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.close.mockResolvedValue();
    mockBrowser.close.mockResolvedValue();
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    // Create a mock logger for tests
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Create new instance
    browserManager = new BrowserManager(mockLogger as any);
  });

  describe("initialize", () => {
    it("should successfully initialize browser and context", async () => {
      await browserManager.initialize();

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: [
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      });

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
      });

      expect(browserManager.isInitialized()).toBe(true);
    });

    it("should not reinitialize browser if already initialized", async () => {
      // First initialization
      await browserManager.initialize();

      // Clear mocks to test second call
      jest.clearAllMocks();

      // Second initialization
      await browserManager.initialize();

      expect(chromium.launch).not.toHaveBeenCalled();
      expect(mockBrowser.newContext).not.toHaveBeenCalled();
    });

    it("should initialize context if browser exists but context doesn't", async () => {
      // First initialization
      await browserManager.initialize();

      // Clear context reference by accessing private property (for testing)
      (browserManager as any).context = null;

      // Clear mocks and reinitialize
      jest.clearAllMocks();
      await browserManager.initialize();

      expect(chromium.launch).not.toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
      });
    });

    it("should handle browser launch failure", async () => {
      const launchError = new Error("Failed to launch browser");
      (chromium.launch as jest.Mock).mockRejectedValue(launchError);

      await expect(browserManager.initialize()).rejects.toThrow("Failed to launch browser");
      expect(browserManager.isInitialized()).toBe(false);
    });

    it("should handle context creation failure", async () => {
      const contextError = new Error("Failed to create context");
      mockBrowser.newContext.mockRejectedValue(contextError);

      await expect(browserManager.initialize()).rejects.toThrow("Failed to create context");
      expect(browserManager.isInitialized()).toBe(false);
    });

    it("should log browser launch", async () => {
      await browserManager.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith("[Browser] Launching browser...");
    });
  });

  describe("getContext", () => {
    it("should return context when initialized", async () => {
      await browserManager.initialize();

      const context = browserManager.getContext();

      expect(context).toBe(mockContext);
    });

    it("should throw error when context is not initialized", () => {
      expect(() => browserManager.getContext()).toThrow(
        "Browser context not initialized. Call initialize() first."
      );
    });
  });

  describe("isInitialized", () => {
    it("should return false when not initialized", () => {
      expect(browserManager.isInitialized()).toBe(false);
    });

    it("should return true when both browser and context are initialized", async () => {
      await browserManager.initialize();

      expect(browserManager.isInitialized()).toBe(true);
    });

    it("should return false when only browser is initialized", async () => {
      // Initialize browser but not context
      await browserManager.initialize();
      (browserManager as any).context = null;

      expect(browserManager.isInitialized()).toBe(false);
    });

    it("should return false when only context exists but browser doesn't", () => {
      // Set context but not browser (this shouldn't happen in real usage)
      (browserManager as any).context = mockContext;
      (browserManager as any).browser = null;

      expect(browserManager.isInitialized()).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should cleanup both context and browser", async () => {
      await browserManager.initialize();
      await browserManager.cleanup();

      expect(mockContext.close).toHaveBeenCalledTimes(1);
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
      expect(browserManager.isInitialized()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith("[Cleanup] Shutting down browser...");
    });

    it("should handle cleanup when not initialized", async () => {
      await browserManager.cleanup();

      expect(mockContext.close).not.toHaveBeenCalled();
      expect(mockBrowser.close).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("[Cleanup] Shutting down browser...");
    });

    it("should handle cleanup when only browser is initialized", async () => {
      // Initialize browser but clear context
      await browserManager.initialize();
      (browserManager as any).context = null;

      await browserManager.cleanup();

      expect(mockContext.close).not.toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith("[Cleanup] Shutting down browser...");
    });

    it("should handle cleanup when only context is initialized", async () => {
      // Set context but clear browser (shouldn't happen in real usage)
      (browserManager as any).context = mockContext;
      (browserManager as any).browser = null;

      await browserManager.cleanup();

      expect(mockContext.close).toHaveBeenCalledTimes(1);
      expect(mockBrowser.close).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("[Cleanup] Shutting down browser...");
    });

    it("should handle context close failure", async () => {
      const closeError = new Error("Failed to close context");
      mockContext.close.mockRejectedValue(closeError);

      await browserManager.initialize();

      await expect(browserManager.cleanup()).rejects.toThrow("Failed to close context");
    });

    it("should handle browser close failure", async () => {
      const closeError = new Error("Failed to close browser");
      mockBrowser.close.mockRejectedValue(closeError);

      await browserManager.initialize();

      await expect(browserManager.cleanup()).rejects.toThrow("Failed to close browser");
      expect(mockContext.close).toHaveBeenCalledTimes(1);
    });

    it("should reset internal state after cleanup", async () => {
      await browserManager.initialize();
      expect(browserManager.isInitialized()).toBe(true);

      await browserManager.cleanup();
      expect(browserManager.isInitialized()).toBe(false);

      // Should be able to initialize again
      await browserManager.initialize();
      expect(browserManager.isInitialized()).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should handle full lifecycle: initialize -> use -> cleanup -> initialize again", async () => {
      // First lifecycle
      await browserManager.initialize();
      expect(browserManager.isInitialized()).toBe(true);

      const context1 = browserManager.getContext();
      expect(context1).toBe(mockContext);

      await browserManager.cleanup();
      expect(browserManager.isInitialized()).toBe(false);

      // Second lifecycle
      await browserManager.initialize();
      expect(browserManager.isInitialized()).toBe(true);

      const context2 = browserManager.getContext();
      expect(context2).toBe(mockContext);
    });

    it("should handle multiple cleanup calls safely", async () => {
      await browserManager.initialize();

      await browserManager.cleanup();
      expect(browserManager.isInitialized()).toBe(false);

      // Second cleanup should not throw
      await browserManager.cleanup();
      expect(browserManager.isInitialized()).toBe(false);
    });

    it("should handle multiple initialize calls safely", async () => {
      await browserManager.initialize();
      expect(chromium.launch).toHaveBeenCalledTimes(1);

      await browserManager.initialize();
      await browserManager.initialize();

      // Should only launch once
      expect(chromium.launch).toHaveBeenCalledTimes(1);
      expect(browserManager.isInitialized()).toBe(true);
    });
  });
});