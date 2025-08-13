// src/logger.ts

import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface LoggerOptions {
  verbose?: boolean;
  logFile?: string;
  level?: LogLevel;
}

export class Logger {
  private verbose: boolean;
  private logFile: string;
  private resolvedLogFile: string;
  private level: LogLevel;

  constructor(options?: LoggerOptions) {
    this.verbose = options?.verbose ?? false;
    this.logFile = options?.logFile ?? 'logs/server.log';
    this.level = options?.level ?? 'INFO';
    // Resolve the log file path relative to process.cwd()
    this.resolvedLogFile = this._resolveLogFilePath(this.logFile);
    // Ensure log directory exists if verbose mode is enabled from the first write
  }

  private _resolveLogFilePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  }

  private async _ensureLogDirExists(): Promise<void> {
    const dir = path.dirname(this.resolvedLogFile);
    try {
      await fsPromises.mkdir(dir, { recursive: true });
    } catch {
      // Ignore errors while creating log directory
    }
  }

  private _logToFile(line: string): void {
    if (!this.verbose) return;
    // Fire-and-forget: attempt to ensure directory exists and append to file
    this._ensureLogDirExists()
      .then(() => fsPromises.appendFile(this.resolvedLogFile, line + os.EOL))
      .catch(() => { /* ignore file logging errors */ });
  }

  private _format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] ${message}`;
  }

  private _formatMessage(message: string, params: any[]): string {
    if (!params || params.length === 0) return message;
    try {
      return util.format(message, ...params);
    } catch {
      return message;
    }
  }

  private _log(level: LogLevel, message: string, ...params: any[]): void {
    const formatted = this._formatMessage(message, params);
    const line = this._format(level, formatted);

    // Log to console
    switch (level) {
      case 'ERROR':
        console.error(line);
        break;
      case 'WARN':
        console.warn(line);
        break;
      case 'INFO':
        console.info(line);
        break;
      case 'DEBUG':
        console.debug(line);
        break;
      default:
        console.log(line);
        break;
    }

    // Additionally log to file if verbose
    this._logToFile(line);
  }

  public error(message: string, ...params: any[]): void {
    this._log('ERROR', message, ...params);
  }

  public warn(message: string, ...params: any[]): void {
    this._log('WARN', message, ...params);
  }

  public info(message: string, ...params: any[]): void {
    this._log('INFO', message, ...params);
  }

  public debug(message: string, ...params: any[]): void {
    this._log('DEBUG', message, ...params);
  }

  // Optional: helper to ensure logs are flushed (not strictly required)
  public async flush(): Promise<void> {
    // No persistent stream; ensure directory exists in case it hasn't yet
    if (!this.verbose) return;
    await this._ensureLogDirExists();
  }
}

export default Logger;