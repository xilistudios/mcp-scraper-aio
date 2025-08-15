import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { handleFetch } from '../../handlers/fetch.js';
import { config } from '../../config.js';

describe('fetch handler', () => {
  let mockLogger: any;
  let context: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    context = { logger: mockLogger, config };
  });

  it('should perform a successful GET request', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        forEach: (fn: (value: string, key: string) => void) => {
          fn('text/plain', 'content-type');
        },
        entries: () => [['content-type', 'text/plain']],
      },
      text: async () => 'Hello world',
    });

    const result: any = await handleFetch(context, {
      url: 'https://example.com',
    });

    expect((global as any).fetch).toHaveBeenCalledWith('https://example.com', {
      method: 'GET',
      headers: undefined,
      body: undefined,
    });

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe(200);
    expect(payload.statusText).toBe('OK');
    expect(payload.body).toBe('Hello world');
    expect(payload.headers['content-type']).toBeDefined();
  });

  it('should perform a POST request with body', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: {
        forEach: (fn: (value: string, key: string) => void) => {
          fn('application/json', 'content-type');
        },
        entries: () => [['content-type', 'application/json']],
      },
      text: async () => '{"ok":true}',
    });

    const args = {
      url: 'https://api.example.com/resource',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"test"}',
    };

    const result: any = await handleFetch(context, args);

    expect((global as any).fetch).toHaveBeenCalledWith(args.url, {
      method: 'POST',
      headers: args.headers,
      body: args.body,
    });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe(201);
    expect(payload.statusText).toBe('Created');
    expect(payload.body).toBe('{"ok":true}');
  });

  it('should throw McpError InvalidParams for invalid URL', async () => {
    await expect(
      handleFetch(context, { url: 'not-a-url' } as any)
    ).rejects.toThrow(McpError);
    await expect(
      handleFetch(context, { url: 'not-a-url' } as any)
    ).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
  });
});
