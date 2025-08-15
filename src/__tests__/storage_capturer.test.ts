import { StorageCapturer } from "../services/storage_capturer";
import { Logger } from "../logger";

describe("StorageCapturer", () => {
  let storageCapturer: StorageCapturer;
  let mockLogger: jest.Mocked<Logger>;
  let mockPage: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    storageCapturer = new StorageCapturer(mockLogger);

    mockPage = {
      context: jest.fn(() => ({
        cookies: jest.fn(),
      })),
      evaluate: jest.fn(),
    };
  });

  describe("captureBrowserStorage", () => {
    it("should capture all browser storage data successfully", async () => {
      const mockCookies = [
        { name: "session_id", value: "abc123", domain: "example.com" },
        { name: "user_pref", value: "dark_mode", domain: "example.com" }
      ] as any[];

      const mockLocalStorage = {
        "theme": "dark",
        "language": "en",
        "user_id": "12345"
      };

      const mockSessionStorage = {
        "temp_data": "temporary",
        "session_token": "xyz789"
      };

      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockResolvedValue(mockCookies)
      });

      mockPage.evaluate
        .mockResolvedValueOnce(mockLocalStorage) // First call for localStorage
        .mockResolvedValueOnce(mockSessionStorage); // Second call for sessionStorage

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      expect(result).toEqual({
        cookies: mockCookies,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage
      });

      // Verify that cookies were retrieved from the context
      expect(mockPage.context().cookies).toHaveBeenCalledTimes(1);

      // Verify that evaluate was called twice (once for localStorage, once for sessionStorage)
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });

    it("should handle empty storage correctly", async () => {
      const mockCookies: any[] = [];
      const mockLocalStorage = {};
      const mockSessionStorage = {};

      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockResolvedValue(mockCookies)
      });

      mockPage.evaluate
        .mockResolvedValueOnce(mockLocalStorage)
        .mockResolvedValueOnce(mockSessionStorage);

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      expect(result).toEqual({
        cookies: [],
        localStorage: {},
        sessionStorage: {}
      });
    });

    it("should handle cookie capture errors gracefully", async () => {
      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockRejectedValue(new Error("Failed to get cookies"))
      });

      mockPage.evaluate
        .mockResolvedValueOnce({}) // localStorage
        .mockResolvedValueOnce({}); // sessionStorage

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[BrowserStorage] Failed to capture browser storage: Failed to get cookies"
      );
    });

    it("should handle localStorage capture errors gracefully", async () => {
      const mockCookies = [{ name: "session_id", value: "abc123" }] as any[];

      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockResolvedValue(mockCookies)
      });

      mockPage.evaluate
        .mockRejectedValueOnce(new Error("Failed to access localStorage"))
        .mockResolvedValueOnce({}); // sessionStorage

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[BrowserStorage] Failed to capture browser storage: Failed to access localStorage"
      );
    });

    it("should handle sessionStorage capture errors gracefully", async () => {
      const mockCookies = [{ name: "session_id", value: "abc123" }] as any[];
      const mockLocalStorage = { "theme": "dark" };

      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockResolvedValue(mockCookies)
      });

      mockPage.evaluate
        .mockResolvedValueOnce(mockLocalStorage)
        .mockRejectedValueOnce(new Error("Failed to access sessionStorage"));

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[BrowserStorage] Failed to capture browser storage: Failed to access sessionStorage"
      );
    });

    it("should handle all storage capture errors gracefully", async () => {
      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockRejectedValue(new Error("Failed to get cookies"))
      });

      mockPage.evaluate
        .mockRejectedValueOnce(new Error("Failed to access localStorage"))
        .mockRejectedValueOnce(new Error("Failed to access sessionStorage"));

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[BrowserStorage] Failed to capture browser storage: Failed to get cookies"
      );
    });

    it("should handle undefined window object in evaluate", async () => {
      const mockCookies = [{ name: "session_id", value: "abc123" }] as any[];

      mockPage.context.mockReturnValue({
        cookies: jest.fn().mockResolvedValue(mockCookies)
      });

      // Mock evaluate to return empty objects when window is undefined
      mockPage.evaluate.mockImplementation((fn: () => any) => {
        return Promise.resolve(fn());
      });

      // Mock the actual function that runs in the browser context
      const localStorageFn = () => {
        const items: Record<string, string> = {};
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key !== null) {
              items[key] = window.localStorage.getItem(key) || '';
            }
          }
        }
        return items;
      };

      const sessionStorageFn = () => {
        const items: Record<string, string> = {};
        if (typeof window !== 'undefined' && window.sessionStorage) {
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key !== null) {
              items[key] = window.sessionStorage.getItem(key) || '';
            }
          }
        }
        return items;
      };

      mockPage.evaluate
        .mockImplementationOnce(() => Promise.resolve(localStorageFn()))
        .mockImplementationOnce(() => Promise.resolve(sessionStorageFn()));

      const result = await storageCapturer.captureBrowserStorage(mockPage);

      // In a real browser context, window would be undefined in Node.js environment
      // So we expect empty objects
      expect(result).toEqual({
        cookies: mockCookies,
        localStorage: {},
        sessionStorage: {}
      });
    });
  });
});