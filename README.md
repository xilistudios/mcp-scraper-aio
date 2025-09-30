# Web Scraper All in One Insights MCP Server

A Model Context Protocol (MCP) server that opens websites and captures all HTTP requests made by those sites. This tool is perfect for analyzing web traffic patterns, tracking third-party integrations, and understanding the network behavior of websites.

## Features

- **Complete Request Capture**: Captures all HTTP requests made by a website including XHR, fetch, and resource requests
- **Detailed Analysis**: Provides comprehensive data including:
  - Request URLs, methods, headers
  - Response status codes and headers
  - Resource types (document, script, stylesheet, image, etc.)
  - Timestamps for timing analysis
  - Domain analysis showing all external services
- **Configurable Options**:
  - Adjustable wait times for dynamic content
  - Option to include/exclude image and media requests
  - Custom viewport and user agent settings
- **Built with Patchright**: Uses Patchright (enhanced Playwright) for reliable browser automation
- **Bun Runtime**
- **Dual Transport Support**: Supports both STDIO (for local/CLI integration) and HTTP (for remote/network access)

## Requirements

- Bun runtime
- Google chrome installed
- git

## Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd mcp_scraper_analytics
   bun install
   ```

2. **Test the Server**
   ```bash
   # Run the server in STDIO mode
   bun src/index.ts

   # Run the server in HTTP mode (listens on http://127.0.0.1:8080)
   bun src/index.ts --http

   # Run the server in HTTP mode on a custom port (e.g., 3000)
   bun src/index.ts --http --port 3000
   ```

## Docker

The project includes a `docker-compose.yml` file for convenient deployment using Docker Compose. It builds the Bun-native image (bundling an undetected Chromium from [`patchright-nodejs`](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs)), mounts the `./logs` directory for persistence, and runs the MCP server in HTTP mode by default (accessible at http://localhost:3031).

### Quick Start

1. Build the image:
   ```bash
   docker compose build
   ```

2. Run the server:
   ```bash
   docker compose up
   ```

   For detached mode:
   ```bash
   docker compose up -d
   ```

3. Stop the server:
   ```bash
   docker compose down
   ```
4. Update your mcp.json:
  ```json
  {
    "mcpServers": {
      "mcp-scraper-aio": {
        "url": "http://localhost:3031/sse"
      }
    }
  }
  ```

### Run in STDIO Mode

To run in STDIO mode for local/CLI integration (keeps STDIN/STDOUT attached for MCP clients):
```bash
docker compose run --rm mcp bun src/index.ts
```

Append flags like `--verbose` as needed (e.g., `bun src/index.ts --verbose`).

### Run MCP Self-Test

To verify the containerized build responds to tool invocations:
```bash
docker compose run --rm mcp bun run mcp-test
```

### Custom Configuration

- **Logs**: `./logs` is mounted to `/app/logs` to persist [`logs/server.log`](logs/server.log) between runs.

- **Environment Variables**: The image sets `PLAYWRIGHT_BROWSERS_PATH` and `PATCHRIGHT_BROWSER_PATH` to `/ms-playwright`. Override them inline:
  ```bash
  docker compose run --rm \
    -e PLAYWRIGHT_BROWSERS_PATH=/custom/playwright \
    -e PATCHRIGHT_BROWSER_PATH=/custom/playwright \
    mcp bun src/index.ts
  ```

- **Custom Port**: To use a different port (e.g., 3000):
  1. Update `docker-compose.yml`:
     - Change `ports: - "3000:3000"`
     - Update `command: ["bun", "src/index.ts", "--http", "--port", "3000"]`
  2. Run `docker compose up`.

The server will log the listening address (e.g., http://127.0.0.1:3000).

## Usage

### Available Tools

The MCP exposes the following tools. Each entry includes the parameter schema, a concrete input example, and an example output the tool will return.

----

1) analyze_website_requests
Description: Open a website in a real browser, capture all HTTP requests, and store a site analysis. The ListTools schema documents default client-side hints: waitTime default 3000 ms, includeImages default false, quickMode default false. See the implementation in [`src/server.ts`](src/server.ts:58).

Parameters:
- url (string, required): The website URL to analyze (must include http:// or https://)
- waitTime (number, optional): Additional wait time in milliseconds for dynamic content (default: 3000, max: 10000)
- includeImages (boolean, optional): Whether to include image and media requests (default: false)
- quickMode (boolean, optional): Use quick loading mode with minimal waiting (default: false)

Example input:
```json
{
  "url": "https://example.com",
  "waitTime": 3000,
  "includeImages": false,
  "quickMode": false
}
```

Example output (stored analysis summary):
```json
{
  "websiteInfo": {
    "url": "https://example.com",
    "title": "Example Domain",
    "analysisTimestamp": "2025-08-15T18:00:00.000Z",
    "renderMethod": "client"
  },
  "requestSummary": {
    "totalRequests": 12,
    "uniqueDomains": 4,
    "requestsByType": {
      "document": 1,
      "script": 6,
      "stylesheet": 2,
      "xhr": 2,
      "font": 1
    }
  },
  "domains": [
    "example.com",
    "cdn.example.com",
    "analytics.google.com"
  ],
  "antiBotDetection": {
    "detected": false
  },
  "browserStorage": {
    "cookies": [
      {
        "name": "sessionid",
        "value": "abc123",
        "domain": "example.com",
        "path": "/",
        "expires": 1692136800,
        "httpOnly": true,
        "secure": true,
        "sameSite": "Lax"
      }
    ],
    "localStorage": {
      "theme": "dark",
      "pref": "1"
    },
    "sessionStorage": {
      "lastVisited": "/home"
    }
  }
}
```

----

2) get_requests_by_domain
Description: Retrieve all captured requests for a specific domain from a previously stored analysis. This reads the stored analysis results; run `analyze_website_requests` first. See handler schema in [`src/handlers/schemas.ts`](src/handlers/schemas.ts:10).

Parameters:
- url (string, required): The original URL that was analyzed
- domain (string, required): The domain to filter requests for (e.g., "api.example.com")

Example input:
```json
{
  "url": "https://example.com",
  "domain": "api.example.com"
}
```

Example output:
```json
{
  "url": "https://example.com",
  "domain": "api.example.com",
  "totalRequests": 3,
  "requests": [
    {
      "id": "req-1",
      "url": "https://api.example.com/v1/data",
      "method": "GET",
      "resourceType": "xhr",
      "status": 200,
      "timestamp": "2025-08-15T18:00:00.200Z"
    },
    {
      "id": "req-2",
      "url": "https://api.example.com/v1/auth",
      "method": "POST",
      "resourceType": "xhr",
      "status": 201,
      "timestamp": "2025-08-15T18:00:00.450Z"
    }
  ]
}
```

----

3) get_request_details
Description: Return full details for a single captured request (headers, body if captured, response, timings). Requires both the analyzed URL and the requestId present in the stored analysis. See the tool registration in [`src/server.ts`](src/server.ts:115).

Parameters:
- url (string, required): The original URL that was analyzed
- requestId (string, required): The unique ID of the request to retrieve

Example input:
```json
{
  "url": "https://example.com",
  "requestId": "req-2"
}
```

Example output:
```json
{
  "id": "req-2",
  "url": "https://api.example.com/v1/auth",
  "method": "POST",
  "requestHeaders": {
    "content-type": "application/json"
  },
  "requestBody": "{\"username\":\"user\",\"password\":\"***\"}",
  "status": 201,
  "responseHeaders": {
    "content-type": "application/json"
  },
  "responseBody": "{\"token\":\"abc123\"}",
  "resourceType": "xhr",
  "timestamp": "2025-08-15T18:00:00.450Z",
  "timings": {
    "start": 1692136800.45,
    "end": 1692136800.47,
    "durationMs": 20
  }
}
```

----

4) get_request_summary
Description: Return the stored analysis summary for a previously analyzed URL. The handler returns the same summary object produced by `analyze_website_requests`. See [`src/handlers/analysis.ts`](src/handlers/analysis.ts:108).

Parameters:
- url (string, required): The website URL that was previously analyzed

Example input:
```json
{
  "url": "https://example.com"
}
```

Example output:
```json
{
  "websiteInfo": {
    "url": "https://example.com",
    "title": "Example Domain",
    "analysisTimestamp": "2025-08-15T18:00:00.000Z",
    "renderMethod": "client"
  },
  "requestSummary": {
    "totalRequests": 12,
    "uniqueDomains": 4,
    "requestsByType": {
      "document": 1,
      "script": 6,
      "stylesheet": 2,
      "xhr": 2,
      "font": 1
    }
  },
  "domains": [
    "example.com",
    "cdn.example.com",
    "analytics.google.com"
  ],
  "antiBotDetection": {
    "detected": false
  },
  "browserStorage": {
    "cookies": [
      {
        "name": "sessionid",
        "value": "abc123",
        "domain": "example.com",
        "path": "/",
        "expires": 1692136800,
        "httpOnly": true,
        "secure": true,
        "sameSite": "Lax"
      }
    ],
    "localStorage": {
      "theme": "dark",
      "pref": "1"
    },
    "sessionStorage": {
      "lastVisited": "/home"
    }
  }
}
```

----

5) extract_html_elements
Description: Extracts important HTML elements (text, images, links, scripts) with their CSS selectors and basic metadata. Uses page-level extraction logic in [`src/services/page_analyzer.ts`](src/services/page_analyzer.ts:1).

Parameters:
- url (string, required): The page URL to analyze
- filterType (string, required): One of: `text`, `image`, `link`, `script`

Example input:
```json
{
  "url": "https://example.com",
  "filterType": "text"
}
```

Example output:
```json
[
  {
    "content": "Hello world",
    "selector": "#intro",
    "type": "text",
    "tag": "p",
    "attributes": {
      "id": "intro",
      "data-test": "x"
    }
  },
  {
    "content": "Title here",
    "selector": ".title",
    "type": "text",
    "tag": "h1",
    "attributes": {}
  }
]
```

----

6) fetch
Description: Perform a direct HTTP request (no browser rendering) and return status, headers and body. The schema is defined in [`src/handlers/schemas.ts`](src/handlers/schemas.ts:25).

Parameters:
- url (string, required): The URL to fetch
- method (string, optional): HTTP method, one of GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS (default: GET)
- headers (object, optional): Key-value map of request headers
- body (string, optional): Request body for POST/PUT/PATCH

Example input:
```json
{
  "url": "https://api.example.com/data",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"key\":\"value\"}"
}
```

Example output:
```json
{
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json"
  },
  "body": "{\"result\":\"ok\"}",
  "durationMs": 123
}
```

----

## Integration with AI Assistants

### Claude Desktop

Add this to your Claude Desktop MCP settings:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "web-scraper-analytics": {
      "command": "bun",
      "args": ["/path/to/mcp_scraper_analytics/src/index.ts"],
      "disabled": false
    }
  }
}
```

For HTTP mode, configure as a remote server:
```json
{
  "mcpServers": {
    "web-scraper-analytics-http": {
      "url": "http://localhost:8080",
      "disabled": false
    }
  }
}
```

### VSCode with Claude Dev

Edit `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "web-scraper-analytics": {
      "command": "bun",
      "args": ["/path/to/mcp_scraper_analytics/src/index.ts"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

For HTTP mode, add a remote configuration:
```json
{
  "mcpServers": {
    "web-scraper-analytics-http": {
      "url": "http://localhost:8080",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Use Cases

### 1. **Security Analysis**
- Identify all third-party services a website connects to
- Discover potential data leakage through external requests
- Track analytics and advertising integrations

### 2. **Performance Optimization**
- Analyze request patterns and timing
- Identify heavy resource loading
- Find opportunities for caching and optimization

### 3. **Competitive Analysis**
- Understand what services competitors use
- Discover third-party integrations and tools
- Analyze traffic patterns and dependencies

### 4. **Compliance Auditing**
- Track external data sharing
- Identify GDPR/privacy compliance issues
- Document all network communications

### 5. **Development Debugging**
- Debug API calls and network issues
- Analyze timing and performance problems
- Understand complex application architectures

## Example Queries for AI Assistants

```
"Analyze the HTTP requests made by https://techcrunch.com and show me all the advertising and analytics services they use"

"Check what third-party services https://shopify.com loads and organize them by category"

"Analyze https://github.com and tell me about their performance characteristics based on the network requests"

"Extract all text and image elements from https://example.com and return their CSS selectors and brief content summaries"
```

## Technical Details

- **Browser Engine**: Chromium via Patchright
- **Request Capture**: Real browser automation with full JavaScript execution
- **Network Monitoring**: Captures both requests and responses
- **Resource Types**: Documents, scripts, stylesheets, images, fonts, XHR, fetch, and more
- **Timeout Handling**: Configurable timeouts for different scenarios
- **Error Handling**: Comprehensive error handling and logging
- **Transport**: Dual support for STDIO and HTTP via StreamableHTTPServerTransport

## Development

### Clean build artifacts

```bash
bun run clean
```

### Testing

#### Test Coverage

```bash
bun run test:coverage
```

#### Test Features

Run the full test suite:

```bash
bun run test
```

# Run tests in watch mode (for development)

```bash
bun run test:watch
```

### Project Structure

- `src/server.ts`: Main MCP server implementation
- `src/handlers/`: Tool request handlers
- `src/services/`: Core analysis services (browser, analyzer, etc.)
- `src/__tests__/`: Unit and integration tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes and add tests
4. Run `bun run test` to ensure everything passes
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Troubleshooting

### Common Issues

- **Browser not found**: Ensure Chromium is installed via `bunx patchright@latest install chromium`
- **Permission errors**: Run with appropriate user permissions for browser automation
- **Network timeouts**: Increase `waitTime` parameter for slow-loading sites

### Debug Mode

Run with verbose logging:

```bash
bun src/index.ts --verbose
```

Or in Docker:

```bash
docker run --rm -it mcp-scraper-analytics --verbose
```

## Roadmap

- Add support for more browser engines (Firefox, WebKit)
- Implement request/response body capture for all resource types
- Add performance metrics and waterfall charts
- Support for authenticated sessions and cookie management
- Integration with popular security scanning tools
- API for programmatic analysis without MCP
