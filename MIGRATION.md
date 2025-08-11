# Migration from Bun to Node.js with SWC

This document outlines the migration from Bun to Node.js using SWC for TypeScript compilation.

## Changes Made

### 1. Package Configuration (`package.json`)
- **Removed**: Bun-specific dependencies (`@types/bun`)
- **Added**: Node.js and SWC dependencies:
  - `@swc/cli` and `@swc/core` for TypeScript compilation
  - `@types/node` for Node.js type definitions
  - `nodemon` for development auto-restart
  - `rimraf` for cross-platform file cleanup
  - `typescript` for type checking

### 2. Build System
- **Replaced**: Bun's built-in TypeScript compilation with SWC
- **Added**: `.swcrc` configuration file for SWC settings
- **Updated**: `tsconfig.json` for Node.js compatibility:
  - Changed `moduleResolution` from "bundler" to "node"
  - Added Node.js-specific compiler options
  - Removed Bun-specific settings

### 3. Scripts
- **build**: `swc src -d dist --strip-leading-paths`
- **dev**: Auto-rebuild with SWC watch + nodemon restart
- **start**: `node dist/index.js`
- **test**: `npx @modelcontextprotocol/inspector node dist/index.js`
- **clean**: `rimraf dist`

### 4. Development Workflow
- **Before**: Direct TypeScript execution with Bun
- **After**: Compile-first workflow with SWC + Node.js
- **Added**: `nodemon.json` for development server configuration

### 5. File Changes
- **Removed**: `bun.lock` (Bun lockfile)
- **Added**: `.swcrc` (SWC configuration)
- **Added**: `nodemon.json` (Nodemon configuration)
- **Updated**: `README.md` with new installation and usage instructions

## Benefits of the Migration

1. **Broader Compatibility**: Node.js has wider ecosystem support
2. **Fast Compilation**: SWC provides extremely fast TypeScript compilation
3. **Production Ready**: Node.js is well-established for production deployments
4. **Tooling**: Better integration with existing Node.js tooling and CI/CD pipelines

## Development Workflow

### Before (Bun)
```bash
bun run dev          # Direct TS execution
bunx @modelcontextprotocol/inspector src/index.ts
```

### After (Node.js + SWC)
```bash
npm run build        # Compile TypeScript
npm run dev          # Watch + compile + restart
npm run test         # Test with MCP Inspector
```

## Configuration Files

### `.swcrc`
```json
{
  "jsc": {
    "parser": { "syntax": "typescript" },
    "target": "es2022"
  },
  "module": { "type": "es6" },
  "sourceMaps": true
}
```

### `nodemon.json`
```json
{
  "watch": ["dist"],
  "ext": "js,json",
  "exec": "node dist/index.js",
  "delay": 1000
}
```

## MCP Integration

Updated configuration for AI assistants:

```json
{
  "mcpServers": {
    "web-scraper-analytics": {
      "command": "node",
      "args": ["/path/to/mcp_scraper_analytics/dist/index.js"]
    }
  }
}
```

## Performance

- **Compilation**: SWC is significantly faster than tsc
- **Runtime**: Node.js provides stable and predictable performance
- **Development**: Hot reload with nodemon for efficient development

The migration maintains all existing functionality while providing a more standard Node.js development experience.