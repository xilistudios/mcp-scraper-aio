# Modular Web Scraper MCP Server Architecture

This document explains the modular structure of the Web Scraper MCP Server, which has been refactored from a single monolithic file into focused, testable components.

## Architecture Overview

The application follows a layered architecture with clear separation of concerns:

```
┌─────────────────┐
│   index.ts      │  ← Entry Point
│                 │
├─────────────────┤
│   server.ts     │  ← Main Server Orchestration
│                 │
├─────────────────┤
│  handlers.ts    │  ← MCP Tool Handlers
│                 │
├─────────────────┤
│  analyzer.ts    │  ← Website Analysis Logic
│                 │
├─────────────────┤
│  browser.ts     │  ← Browser Management
│                 │
├─────────────────┤
│   types.ts      │  ← Type Definitions
└─────────────────┘
```

## Module Responsibilities

### 1. `types.ts` - Type Definitions
**Single Responsibility**: Centralized type definitions and interfaces

- `CapturedRequest`: HTTP request data structure
- `SiteAnalysisResult`: Complete analysis result
- `AnalysisOptions`: Configuration options for analysis
- `RequestFilter`: Filter options for request queries
- `AnalysisSummary`: Client-facing summary format

**Benefits**:
- Consistent typing across modules
- Easy to maintain and extend
- Clear contracts between components

### 2. `browser.ts` - Browser Management
**Single Responsibility**: Browser lifecycle and context management

**Key Features**:
- Browser initialization and configuration
- Context management with proper viewport and user agent
- Resource cleanup and shutdown handling
- State checking methods

**Benefits**:
- Isolated browser concerns
- Reusable across different analysis scenarios
- Proper resource management
- Easy to mock for testing

### 3. `analyzer.ts` - Website Analysis Engine
**Single Responsibility**: HTTP request capture and website analysis

**Key Features**:
- Request/response monitoring setup
- URL validation and navigation
- Network stability waiting
- Response body filtering and truncation
- Analysis result generation

**Benefits**:
- Complex analysis logic separated from server concerns
- Highly configurable through options
- Comprehensive error handling
- Testable in isolation

### 4. `handlers.ts` - MCP Tool Handlers
**Single Responsibility**: MCP protocol tool implementation

**Key Features**:
- Website analysis request handling
- Domain-filtered request retrieval
- Request detail extraction
- Analysis result caching and management

**Benefits**:
- Clean separation of MCP protocol logic
- Stateful analysis result management
- Comprehensive error handling with proper MCP error codes
- Easy to extend with new tools

### 5. `server.ts` - Server Orchestration
**Single Responsibility**: MCP server setup and component coordination

**Key Features**:
- Server initialization and configuration
- Tool registration and routing
- Error handling and graceful shutdown
- Component lifecycle management

**Benefits**:
- Clear entry point for server functionality
- Proper dependency injection
- Centralized error handling
- Clean shutdown procedures

### 6. `index.ts` - Application Entry Point
**Single Responsibility**: Application bootstrap

**Key Features**:
- Server instantiation
- Error handling at application level
- Process exit management

## Key Architectural Benefits

### 1. **Modularity**
Each module has a single, well-defined responsibility:
- Browser management is separate from analysis logic
- MCP protocol handling is isolated from business logic
- Type definitions are centralized and reusable

### 2. **Testability**
Components can be tested in isolation:
```typescript
// Example: Testing browser manager independently
const browserManager = new BrowserManager();
expect(browserManager.isInitialized()).toBe(false);

// Example: Testing analyzer with mock browser manager
const mockBrowser = new MockBrowserManager();
const analyzer = new WebsiteAnalyzer(mockBrowser);
```

### 3. **Maintainability**
- Clear interfaces between components
- Easy to locate and modify specific functionality
- Reduced coupling between concerns

### 4. **Extensibility**
- New analysis features can be added to `analyzer.ts`
- New MCP tools can be added to `handlers.ts`
- Additional browser configurations can be added to `browser.ts`

### 5. **Error Handling**
Each layer handles errors appropriately:
- Browser errors in `browser.ts`
- Analysis errors in `analyzer.ts`
- MCP protocol errors in `handlers.ts`
- Server errors in `server.ts`

## Dependency Flow

```
index.ts
    ↓
server.ts
    ├→ BrowserManager (browser.ts)
    ├→ WebsiteAnalyzer (analyzer.ts)
    │    └→ BrowserManager
    └→ MCPToolHandlers (handlers.ts)
         └→ WebsiteAnalyzer
```

## Usage Examples

### Creating Components Independently
```typescript
// Browser management
const browserManager = new BrowserManager();
await browserManager.initialize();

// Analysis with dependency injection
const analyzer = new WebsiteAnalyzer(browserManager);
const result = await analyzer.analyzeWebsite({
  url: "https://example.com",
  waitTime: 5000,
  includeImages: false
});

// Handler with dependency injection
const handlers = new MCPToolHandlers(analyzer);
```

### Testing Individual Components
```typescript
// Mock dependencies for isolated testing
class MockBrowserManager extends BrowserManager {
  async initialize(): Promise<void> {
    // Mock implementation
  }
}

const mockBrowser = new MockBrowserManager();
const analyzer = new WebsiteAnalyzer(mockBrowser);
// Test analyzer logic without real browser
```

## Migration Benefits

The modular structure provides several advantages over the original monolithic approach:

1. **Reduced Complexity**: Each file focuses on one concern
2. **Better Error Isolation**: Errors are contained within relevant modules
3. **Improved Code Reuse**: Components can be reused in different contexts
4. **Enhanced Testing**: Each component can be tested independently
5. **Easier Debugging**: Issues can be traced to specific modules
6. **Better Documentation**: Each module can be documented separately
7. **Team Development**: Multiple developers can work on different modules simultaneously

## Future Enhancements

The modular structure makes it easy to add new features:

- **Caching Module**: Add persistent storage for analysis results
- **Metrics Module**: Add performance and usage tracking
- **Configuration Module**: Add runtime configuration management
- **Plugin System**: Add extensible analysis plugins
- **Security Module**: Add authentication and authorization