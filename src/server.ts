import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server as HttpServer,
} from 'node:http';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { BrowserManager } from './browser.js';
import { WebsiteAnalyzer } from './analyzer.js';
import { MCPToolHandlers } from './handlers.js';
import { type AnalysisOptions, type RequestFilter } from './types.js';
import { Logger } from './logger.js';

/**
 * Main MCP Server class that orchestrates all components
 */
export class WebScraperMCPServer {
  private server: Server;
  private browserManager: BrowserManager;
  private analyzer: WebsiteAnalyzer;
  private toolHandlers: MCPToolHandlers;
  private logger: Logger;
  private httpServer?: HttpServer;

  constructor(logger: Logger) {
    this.logger = logger;

    this.logger.info('[Setup] Initializing Web Scraper MCP server...');

    // Initialize core components with logger dependency
    this.browserManager = new BrowserManager(this.logger);
    this.analyzer = new WebsiteAnalyzer(this.browserManager, this.logger);
    this.toolHandlers = new MCPToolHandlers(this.analyzer, this.logger);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'web-scraper-analytics',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupMCPHandlers();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Create a new MCP server instance with handlers set up
   */
  private createMcpServer(): Server {
    const newServer = new Server(
      {
        name: 'web-scraper-analytics',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupMCPHandlersFor(newServer);
    this.setupErrorHandlingFor(newServer);

    return newServer;
  }

  /**
   * Set up MCP request handlers for tools on the given server
   */
  private setupMCPHandlersFor(server: Server): void {
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_website_requests',
          description:
            'Open a website and capture all HTTP requests made by the site. Returns only domain summary.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description:
                  'The URL to analyze (must include http:// or https://)',
              },
              waitTime: {
                type: 'number',
                description:
                  'Additional wait time in milliseconds for dynamic content (default: 3000, max: 10000)',
                default: 3000,
              },
              includeImages: {
                type: 'boolean',
                description:
                  'Whether to include image and media requests (default: false)',
                default: false,
              },
              quickMode: {
                type: 'boolean',
                description:
                  'Use quick loading mode with minimal waiting (default: false)',
                default: false,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'get_requests_by_domain',
          description:
            'Get all requests made to a specific domain from a previous website analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL that was previously analyzed',
              },
              domain: {
                type: 'string',
                description:
                  "The domain to filter requests for (e.g., 'example.com')",
              },
            },
            required: ['url', 'domain'],
          },
        },
        {
          name: 'get_request_details',
          description:
            'Get full details of a specific request including headers, body, and response',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL that was previously analyzed',
              },
              requestId: {
                type: 'string',
                description: 'The unique ID of the request to get details for',
              },
            },
            required: ['url', 'requestId'],
          },
        },
        {
          name: 'get_request_summary',
          description:
            'Get a summary of requests by domain and type from a previous analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL that was previously analyzed',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'extract_html_elements',
          description:
            'Extract important HTML elements with their CSS selectors, filtered by type (text, image, link, script)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description:
                  'The URL to analyze (must include http:// or https://)',
              },
              filterType: {
                type: 'string',
                enum: ['text', 'image', 'link', 'script'],
                description: 'Type of elements to extract',
              },
            },
            required: ['url', 'filterType'],
          },
        },
        {
          name: 'fetch',
          description:
            'Makes a direct HTTP request to a specified URL and returns status, headers, and body. Does not perform browser rendering.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to fetch (must be a valid URL).',
              },
              method: {
                type: 'string',
                enum: [
                  'GET',
                  'POST',
                  'PUT',
                  'DELETE',
                  'PATCH',
                  'HEAD',
                  'OPTIONS',
                ],
                description: 'The HTTP method to use.',
                default: 'GET',
              },
              headers: {
                type: 'object',
                description: 'A key-value map of request headers.',
              },
              body: {
                type: 'string',
                description: 'The request body (for POST, PUT, PATCH).',
              },
            },
            required: ['url'],
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'analyze_website_requests':
            return await this.toolHandlers.handleAnalyzeWebsite(
              args as unknown as AnalysisOptions
            );

          case 'get_requests_by_domain':
            return await this.toolHandlers.handleGetRequestsByDomain(
              args as unknown as RequestFilter
            );

          case 'get_request_details':
            return await this.toolHandlers.handleGetRequestDetails(
              args as unknown as RequestFilter
            );

          case 'get_request_summary':
            return await this.toolHandlers.handleGetRequestSummary(
              (args as unknown as { url: string }).url
            );

          case 'extract_html_elements':
            return await this.toolHandlers.handleExtractHtmlElements(
              args as unknown as {
                url: string;
                filterType: 'text' | 'image' | 'link' | 'script';
              }
            );

          case 'fetch':
            return await this.toolHandlers.handleFetch(
              args as unknown as {
                url: string;
                method?: string;
                headers?: Record<string, string>;
                body?: string;
              }
            );
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error: unknown) {
        if (error instanceof McpError) {
          throw error;
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[Error] Tool execution failed: ${errorMessage}`);

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  /**
   * Set up MCP request handlers for tools (for stdio server)
   */
  private setupMCPHandlers(): void {
    this.setupMCPHandlersFor(this.server);
  }

  /**
   * Set up error handling for the given server
   */
  private setupErrorHandlingFor(server: Server): void {
    server.onerror = (error) => {
      this.logger.error(
        `[Server Error] ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    };
  }

  /**
   * Set up error handling for the stdio server
   */
  private setupErrorHandling(): void {
    this.setupErrorHandlingFor(this.server);
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(
        `[Shutdown] Received ${signal}, shutting down gracefully...`
      );
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error(
        `[Uncaught Exception] ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error(
        `[Unhandled Rejection] at: ${
          reason instanceof Error ? reason.message : String(reason)
        }`
      );
      await this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Clean up all resources
   */
  private async cleanup(): Promise<void> {
    this.logger.info('[Cleanup] Shutting down server...');

    if (this.httpServer) {
      this.httpServer.close();
      this.logger.info('[Cleanup] HTTP server closed');
    }

    try {
      await this.browserManager.cleanup();
      this.toolHandlers.clearAnalysisResults();
    } catch (error) {
      this.logger.error(
        `[Cleanup Error] ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Start the MCP server
   * @throws {Error} If server fails to start
   */
  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('[Server] Web Scraper MCP server running on stdio');
    } catch (error) {
      this.logger.error(
        `[Server] Failed to start server: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Start the MCP server over HTTP (stateless)
   * @param port The port to listen on (default: 8080)
   * @throws {Error} If server fails to start
   */
  async runHttp(port: number = 8080): Promise<void> {
    try {
      const server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          try {
            // Enable CORS for any origin
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader(
              'Access-Control-Allow-Methods',
              'GET, POST, OPTIONS, PUT, DELETE, PATCH'
            );
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            if (req.method === 'GET' || req.method === 'DELETE') {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: {
                    code: -32000,
                    message: 'Method not allowed.',
                  },
                  id: null,
                })
              );
              return;
            }

            if (req.method === 'POST') {
              const mcpServer = this.createMcpServer();
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
              });

              await mcpServer.connect(transport);

              res.on('close', () => {
                transport.close();
                mcpServer.close();
              });

              await transport.handleRequest(req, res);
              return;
            }

            // For other methods, return 405
            res.writeHead(405);
            res.end();
          } catch (error) {
            this.logger.error(
              `Error handling request: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            if (!res.headersSent) {
              res.writeHead(500);
              res.end();
            }
          }
        }
      );

      this.httpServer = server;

      await new Promise<void>((resolve, reject) => {
        server.listen(port, '0.0.0.0', (err?: Error) => {
          if (err) {
            reject(err);
            return;
          }
          const addr = server.address() as AddressInfo;
          this.logger.info(
            `[Server] Web Scraper MCP server running on http://127.0.0.1:${addr.port}`
          );
          resolve();
        });
      });
    } catch (error) {
      this.logger.error(
        `[Server] Failed to start HTTP server: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Get server status information (for testing/monitoring)
   * @returns {object} Server status information
   */
  getStatus(): object {
    return {
      browserInitialized: this.browserManager.isInitialized(),
      storedResults: this.toolHandlers.getStoredResultsCount(),
      serverName: 'web-scraper-analytics',
      version: '1.0.0',
      httpServerRunning: !!this.httpServer,
    };
  }
}
