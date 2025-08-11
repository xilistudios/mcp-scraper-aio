#!/usr/bin/env node
import { WebScraperMCPServer } from "./server.js";

/**
 * Main entry point for the Web Scraper MCP Server
 * This server provides tools for analyzing websites and capturing HTTP requests
 */
async function main(): Promise<void> {
  try {
    const server = new WebScraperMCPServer();
    await server.run();
  } catch (error) {
    console.error("[Main] Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("[Main] Unhandled error:", error);
  process.exit(1);
});