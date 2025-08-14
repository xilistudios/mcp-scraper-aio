# Web Scraper Analytics All in One MCP Server

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
- **Node.js Runtime**: Compiled with SWC for fast TypeScript compilation and Node.js compatibility

## Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd mcp_scraper_analytics
   npm install
   ```

2. **Build and Test the Server**
   ```bash
   # Build the project
   npm run build

   # Run in development mode (with auto-rebuild)
   npm run dev

   # Or test with MCP Inspector
   npm run test
   ```

## Usage

### Available Tools

#### 1. `analyze_website_requests`
Analyzes a website and captures all HTTP requests.

**Parameters:**
- `url` (required): The website URL to analyze (must include http:// or https://)
- `waitTime` (optional): Additional wait time in milliseconds for dynamic content (default: 5000)
- `includeImages` (optional): Whether to include image and media requests (default: false)

**Example:**
```json
{
  "url": "https://example.com",
  "waitTime": 10000,
  "includeImages": false
}
```

#### 2. `get_request_summary`
Gets a summary of requests from a previous analysis (currently re-analyzes the site).

**Parameters:**
- `url` (required): The website URL to analyze

#### 3. `extract_html_elements`
Extracts important HTML elements from a page and returns their CSS selectors, tag names, and basic metadata filtered by type (text, image, link, script).

**Parameters:**
- `url` (required): The website URL to analyze (must include http:// or https://)
- `filterType` (required): The type of elements to extract. One of: `text`, `image`, `link`, `script`

**Example:**
```json
{
  "url": "https://example.com",
  "filterType": "text"
}
```

### Example Output

```json
{
  "websiteInfo": {
    "url": "https://example.com",
    "title": "Example Domain",
    "analysisTimestamp": "2024-03-07T10:30:00.000Z"
  },
  "requestSummary": {
    "totalRequests": 15,
    "uniqueDomains": 5,
    "requestsByType": {
      "document": 1,
      "script": 8,
      "stylesheet": 3,
      "xhr": 2,
      "font": 1
    }
  },
  "domains": [
    "example.com",
    "cdn.example.com",
    "analytics.google.com",
    "fonts.googleapis.com"
  ],
  "requests": [
    {
      "url": "https://example.com/",
      "method": "GET",
      "resourceType": "document",
      "status": 200,
      "timestamp": "2024-03-07T10:30:00.100Z"
    },
    // ... more requests
  ]
}
```

## Integration with AI Assistants

### Claude Desktop

Add this to your Claude Desktop MCP settings:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "web-scraper-analytics": {
      "command": "node",
      "args": ["/path/to/mcp_scraper_analytics/dist/index.js"],
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
      "command": "node",
      "args": ["/path/to/mcp_scraper_analytics/dist/index.js"],
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

## Development

### Scripts

```bash
# Build the project
npm run build

# Run in development mode (with auto-rebuild and restart)
npm run dev

# Test with MCP Inspector
npm run mcp-test

# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Start production server
npm run start

# Clean build artifacts
npm run clean
```

### Testing

The project includes comprehensive Jest unit tests for the core analyzer functionality.

#### Test Coverage

- **66.19% Statement Coverage** for analyzer.ts
- **41.17% Branch Coverage** for analyzer.ts
- **46.15% Function Coverage** for analyzer.ts

#### Test Features

- ✅ **URL Validation**: Tests for proper URL format validation
- ✅ **Error Handling**: Comprehensive error handling tests
- ✅ **Configuration Options**: Tests for all analysis options (waitTime, quickMode, includeImages)
- ✅ **Request Monitoring**: Tests for HTTP request capture and filtering
- ✅ **Browser Integration**: Mocked browser interactions
- ✅ **Network Timeouts**: Graceful handling of network timeouts
- ✅ **Response Processing**: Tests for response body capture and truncation
- ✅ **Domain Analysis**: Tests for domain extraction and analysis

#### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

### Project Structure

```
src/
├── index.ts          # Main MCP server implementation
package.json          # Dependencies and scripts
tsconfig.json        # TypeScript configuration
README.md            # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the MCP inspector
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Troubleshooting

### Common Issues

1. **Browser Launch Fails**
   - Ensure you have proper permissions for browser automation
   - On macOS, you might need to grant accessibility permissions

2. **Requests Not Captured**
   - Some requests might be made before the event listeners are attached
   - Try increasing the `waitTime` parameter
   - Check if the site uses complex async loading

3. **Memory Issues**
   - Large sites with many requests might consume significant memory
   - Consider filtering out images and media if not needed
   - Close browser contexts properly

### Debug Mode

Enable verbose logging by setting the environment variable:
```bash
DEBUG=1 bun run dev
```

## Roadmap

- [ ] Add request/response body capture (for POST requests)
- [ ] Implement result caching for repeated analyses
- [ ] Add support for custom browser configurations
- [ ] Implement request filtering by domain/type
- [ ] Add export formats (CSV, JSON, XML)
- [ ] Implement screenshot capture alongside request analysis
