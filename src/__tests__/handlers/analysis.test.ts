import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  handleAnalyzeWebsite,
  handleGetRequestSummary,
} from '../../handlers/analysis.js';
import {
  InvalidUrlError,
  AnalysisTimeoutError,
  ResourceNotFoundError,
} from '../../errors.js';
import { config } from '../../config.js';

describe('analysis handlers', () => {
  let mockAnalyzer: any;
  let mockLogger: any;
  let context: any;

  const sampleUrl = 'https://example.com';
  const sampleDomain = 'api.example.com';
  const sampleRequestId = 'req-123';

  const sampleRequest = {
    id: sampleRequestId,
    url: `https://${sampleDomain}/api/data`,
    method: 'GET',
    headers: { 'user-agent': 'test-agent' },
    timestamp: '2024-01-01T12:00:00Z',
    status: 200,
    responseHeaders: { 'content-type': 'application/json' },
    responseBody: '{"data": "test"}',
    resourceType: 'xhr',
  };

  const sampleAnalysisResult = {
    url: sampleUrl,
    title: 'Test Website',
    requests: [sampleRequest],
    totalRequests: 1,
    uniqueDomains: [sampleDomain],
    requestsByType: { xhr: 1 },
    analysisTimestamp: '2024-01-01T12:00:00Z',
    renderMethod: 'unknown',
    antiBotDetection: { detected: false },
    browserStorage: { cookies: [], localStorage: {}, sessionStorage: {} },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    mockAnalyzer = { analyzeWebsite: jest.fn() };
    context = {
      analyzer: mockAnalyzer,
      analysisResults: new Map(),
      logger: mockLogger,
      config,
    };
  });

  it('should successfully analyze a website with valid options', async () => {
    mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
    const result: any = await handleAnalyzeWebsite(context, {
      url: sampleUrl,
      waitTime: 3000,
      includeImages: false,
      quickMode: false,
    });
    expect(mockAnalyzer.analyzeWebsite).toHaveBeenCalledWith({
      url: sampleUrl,
      waitTime: 3000,
      includeImages: false,
      quickMode: false,
    });
    expect(result.content[0].type).toBe('text');
    const summary = JSON.parse(result.content[0].text);
    expect(summary.websiteInfo.url).toBe(sampleUrl);
    expect(summary.requestSummary.totalRequests).toBe(1);
  });

  it('should throw McpError for invalid URL', async () => {
    await expect(
      handleAnalyzeWebsite(context, { url: 'invalid-url' })
    ).rejects.toThrow(McpError);
    await expect(
      handleAnalyzeWebsite(context, { url: 'invalid-url' })
    ).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
  });

  it('should map analyzer errors to InternalError', async () => {
    mockAnalyzer.analyzeWebsite.mockRejectedValue(new Error('Network timeout'));
    await expect(
      handleAnalyzeWebsite(context, { url: sampleUrl, waitTime: 3000 })
    ).rejects.toThrow(
      new McpError(ErrorCode.InternalError, 'Unknown analysis error')
    );
  });

  it('should map InvalidUrlError to InvalidParams', async () => {
    mockAnalyzer.analyzeWebsite.mockRejectedValue(
      new InvalidUrlError('Invalid URL provided')
    );
    await expect(
      handleAnalyzeWebsite(context, { url: sampleUrl })
    ).rejects.toThrow(
      new McpError(ErrorCode.InvalidParams, 'Invalid URL provided')
    );
  });

  it('should map AnalysisTimeoutError to RequestTimeout', async () => {
    mockAnalyzer.analyzeWebsite.mockRejectedValue(
      new AnalysisTimeoutError('Analysis timed out')
    );
    await expect(
      handleAnalyzeWebsite(context, { url: sampleUrl })
    ).rejects.toThrow(
      new McpError(ErrorCode.RequestTimeout, 'Analysis timed out')
    );
  });

  it('should map ResourceNotFoundError to InvalidParams', async () => {
    mockAnalyzer.analyzeWebsite.mockRejectedValue(
      new ResourceNotFoundError('Resource not found')
    );
    await expect(
      handleAnalyzeWebsite(context, { url: sampleUrl })
    ).rejects.toThrow(
      new McpError(ErrorCode.InvalidParams, 'Resource not found')
    );
  });

  it('should handle quick mode correctly', async () => {
    mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
    await handleAnalyzeWebsite(context, { url: sampleUrl, quickMode: true });
    expect(mockAnalyzer.analyzeWebsite).toHaveBeenCalledWith({
      url: sampleUrl,
      waitTime: config.timeouts.quickModeWait,
      includeImages: false,
      quickMode: true,
    });
  });

  it('should use default values for optional parameters', async () => {
    mockAnalyzer.analyzeWebsite.mockResolvedValue(sampleAnalysisResult);
    await handleAnalyzeWebsite(context, { url: sampleUrl });
    expect(mockAnalyzer.analyzeWebsite).toHaveBeenCalledWith({
      url: sampleUrl,
      waitTime: config.timeouts.defaultWait,
      includeImages: false,
      quickMode: false,
    });
  });

  it('handleGetRequestSummary should return summary for stored analysis', async () => {
    context.analysisResults.set(sampleUrl, sampleAnalysisResult);
    const result: any = await handleGetRequestSummary(context, sampleUrl);
    expect(result.content[0].type).toBe('text');
    const summary = JSON.parse(result.content[0].text);
    expect(summary.websiteInfo.url).toBe(sampleUrl);
  });

  it('handleGetRequestSummary should throw when not found', async () => {
    await expect(handleGetRequestSummary(context, sampleUrl)).rejects.toThrow(
      McpError
    );
  });

  it('should validate URL format', async () => {
    const invalidUrls = [
      'invalid-url',
      'ftp://example.com',
      "javascript:alert('xss')",
      '',
      null,
      undefined,
    ];
    for (const u of invalidUrls) {
      await expect(
        handleAnalyzeWebsite(context, { url: u as any })
      ).rejects.toThrow(McpError);
    }
  });

  it('should validate waitTime parameter', async () => {
    const invalidWaitTimes = [-1, -100, 'invalid', null];
    for (const w of invalidWaitTimes) {
      await expect(
        handleAnalyzeWebsite(context, { url: sampleUrl, waitTime: w as any })
      ).rejects.toThrow(McpError);
    }
  });

  it('should validate includeImages and quickMode', async () => {
    await expect(
      handleAnalyzeWebsite(context, {
        url: sampleUrl,
        includeImages: 'no' as any,
      })
    ).rejects.toThrow(McpError);
    await expect(
      handleAnalyzeWebsite(context, { url: sampleUrl, quickMode: 'yes' as any })
    ).rejects.toThrow(McpError);
  });
});
