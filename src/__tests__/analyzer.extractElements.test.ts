import { WebsiteAnalyzer } from "../analyzer.js";
import { InvalidUrlError } from "../errors.js";
import { config } from "../config.js";

describe('WebsiteAnalyzer.extractHtmlElements', () => {
  let mockLogger: any;
  let fakeBrowserManager: any;
  let analyzer: WebsiteAnalyzer;
  let fakePage: any;
  let fakeContext: any;

  beforeEach(() => {
    jest.clearAllMocks && jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    fakePage = {
      goto: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    fakeContext = {
      newPage: jest.fn().mockResolvedValue(fakePage),
    };

    fakeBrowserManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getContext: jest.fn().mockReturnValue(fakeContext),
    };

    analyzer = new WebsiteAnalyzer(fakeBrowserManager, mockLogger);
  });

  it('navigates to the URL, delegates extraction and closes the page', async () => {
    const sampleElements = [
      { content: 'Hello world', selector: '#intro', type: 'text', tag: 'p', attributes: { id: 'intro' } },
      { content: 'Title here', selector: '.title', type: 'text', tag: 'h1', attributes: {} },
    ];

    // Override private pageAnalyzer
    (analyzer as any).pageAnalyzer = {
      extractImportantElements: jest.fn().mockResolvedValue(sampleElements),
    };

    const result = await analyzer.extractHtmlElements('https://example.com', 'text');

    expect(fakePage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation });
    expect(result).toEqual(sampleElements);
    expect(fakePage.close).toHaveBeenCalled();

    // Logging checks
    expect(mockLogger.info).toHaveBeenCalledWith(`[Extraction] Extracting elements from https://example.com with filter 'text'`);
    expect(mockLogger.info).toHaveBeenCalledWith(`[Navigation] Loading https://example.com...`);
  });

  it('throws InvalidUrlError for invalid URL', async () => {
    // Ensure pageAnalyzer won't be called
    (analyzer as any).pageAnalyzer = { extractImportantElements: jest.fn() };
 
    await expect(analyzer.extractHtmlElements('not-a-valid-url', 'text')).rejects.toBeInstanceOf(InvalidUrlError);
  });

  it('logs and throws generic error when navigation fails', async () => {
    // make goto throw
    fakePage.goto.mockRejectedValue(new Error('Network issue'));

    (analyzer as any).pageAnalyzer = { extractImportantElements: jest.fn() };

    await expect(analyzer.extractHtmlElements('https://example.com', 'text')).rejects.toThrow('Failed to extract elements');

    expect(mockLogger.error).toHaveBeenCalled();
    const callArg = (mockLogger.error as jest.Mock).mock.calls[0][0];
    expect(callArg).toMatch(/\[Error\] Failed to extract elements from https:\/\/example\.com: Network issue/);

    expect(fakePage.close).toHaveBeenCalled();
  });
});