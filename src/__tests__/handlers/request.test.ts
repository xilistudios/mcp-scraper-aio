import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  handleGetRequestsByDomain,
  handleGetRequestDetails,
} from '../../handlers/request.js';

describe('request handlers', () => {
  let mockLogger: any;
  let mockAnalyzer: any;
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    mockAnalyzer = {
      /* not used directly here */
    };
    context = {
      analyzer: mockAnalyzer,
      logger: mockLogger,
      analysisResults: new Map(),
    };
  });

  describe('handleGetRequestsByDomain', () => {
    beforeEach(async () => {
      context.analysisResults.set(sampleUrl, sampleAnalysisResult);
    });

    it('should filter requests by domain', async () => {
      const result: any = await handleGetRequestsByDomain(context, {
        url: sampleUrl,
        domain: sampleDomain,
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.totalRequests).toBe(1);
      expect(data.domain).toBe(sampleDomain);
    });

    it('should throw error when domain not provided', async () => {
      await expect(
        handleGetRequestsByDomain(context, { url: sampleUrl } as any)
      ).rejects.toThrow(McpError);
      await expect(
        handleGetRequestsByDomain(context, { url: sampleUrl } as any)
      ).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
    });
  });

  describe('handleGetRequestDetails', () => {
    beforeEach(() => {
      context.analysisResults.set(sampleUrl, sampleAnalysisResult);
    });

    it('should retrieve request details by ID', async () => {
      const result: any = await handleGetRequestDetails(context, {
        url: sampleUrl,
        requestId: sampleRequestId,
      });
      const details = JSON.parse(result.content[0].text);
      expect(details.id).toBe(sampleRequestId);
      expect(details.responseBody).toBe('{"data": "test"}');
    });

    it('should throw error when request ID not provided', async () => {
      await expect(
        handleGetRequestDetails(context, { url: sampleUrl } as any)
      ).rejects.toThrow(McpError);
      await expect(
        handleGetRequestDetails(context, { url: sampleUrl } as any)
      ).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
    });
  });
});
