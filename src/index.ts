#!/usr/bin/env node
import { WebScraperMCPServer } from './server.js';
import { Logger } from './logger.js';

/**
 * Main entry point for the Web Scraper MCP Server
 * This server provides tools for analyzing websites and capturing HTTP requests
 */
async function main(): Promise<void> {
  // Parse command-line arguments for verbose mode, transport type, and port
  const argv = process.argv.slice(2);
  const verbose = argv.includes('-v') || argv.includes('--verbose');
  const useHttp = argv.includes('--http');

  let port = 8080;
  const portIndex = argv.indexOf('--port');
  if (portIndex !== -1 && portIndex + 1 < argv.length) {
    const portStr = argv[portIndex + 1];
    if (portStr) {
      const parsedPort = parseInt(portStr, 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        port = parsedPort;
      } else {
        console.error(`Invalid port: ${portStr}. Using default 8080.`);
      }
    }
  }

  const logger = new Logger({ verbose, logFile: 'logs/server.log' });

  try {
    const server = new WebScraperMCPServer(logger);
    if (useHttp) {
      await server.runHttp(port);
    } else {
      await server.run();
    }
  } catch (error) {
    logger.error('[Main] Failed to start server:', error as Error);
    process.exit(1);
  } finally {
    // Ensure logs are flushed if needed
    await logger.flush();
  }
}

// Start the server
main().catch((error) => {
  // This catch is a safety net; actual logging should be done in main
  console.error('[Main] Unhandled error:', error);
  process.exit(1);
});
