/**
 * Custom error class for website analysis timeout scenarios
 */
export class AnalysisTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisTimeoutError";
  }
}

/**
 * Custom error class for invalid URL scenarios
 */
export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUrlError";
  }
}

/**
 * Custom error class for resource not found scenarios
 */
export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}