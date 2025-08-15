import { type Page, type Response } from "patchright";
import { randomUUID } from "crypto";
import { type CapturedRequest } from "../types.js";
import { Logger } from "../logger.js";
import { config } from "../config.js";

/**
 * Service responsible for setting up listeners on a page to capture request and response data
 */
export class RequestMonitor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Set up request and response monitoring for the page
   * @param {Page} page - The browser page to monitor
   * @param {CapturedRequest[]} capturedRequests - Array to store captured requests
   * @param {boolean} includeImages - Whether to include image and media requests
   */
  setupRequestMonitoring(page: Page, capturedRequests: CapturedRequest[], includeImages: boolean): void {
    // Monitor outgoing requests
    page.on("request", (request) => {
      const resourceType = request.resourceType();

      // Skip images unless specifically requested
      if (!includeImages && (resourceType === "image" || resourceType === "media")) {
        return;
      }

      const capturedRequest: CapturedRequest = {
        id: randomUUID(),
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() || undefined,
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
      };

      capturedRequests.push(capturedRequest);
      this.logger.info(`[Request] ${request.method()} ${request.url()}`);
    });

    // Monitor incoming responses
    page.on("response", async (response) => {
      await this.captureResponseData(capturedRequests, response);
    });
  }

  /**
   * Capture response data and associate it with the corresponding request
   * @param {CapturedRequest[]} capturedRequests - Array of captured requests
   * @param {Response} response - The response object from the browser
   */
  private async captureResponseData(capturedRequests: CapturedRequest[], response: Response): Promise<void> {
    // Find the corresponding request and add response data
    const requestIndex = capturedRequests.findIndex(
      (req) => req.url === response.url() && !req.status
    );

    if (requestIndex >= 0 && requestIndex < capturedRequests.length) {
      const request = capturedRequests[requestIndex];
      if (request) {
        request.status = response.status();
        request.responseHeaders = response.headers();

        // Capture response body for text-based content only
        try {
          const contentType = response.headers()["content-type"] || "";
          const resourceType = request.resourceType;

          if (this.shouldCaptureResponseBody(resourceType, contentType)) {
            const responseBody = await response.text();
            request.responseBody = this.truncateResponseBody(responseBody);
          }
        } catch (error) {
          this.logger.error(`[Response] Failed to capture response body for ${response.url()}: ${error instanceof Error ? error.message : String(error)}`);
          request.responseBody = "[Failed to capture response body]";
        }
      }
    }
  }

  /**
   * Determine if response body should be captured based on content type and resource type
   * @param {string} resourceType - The resource type from the request
   * @param {string} contentType - The content type from the response headers
   * @returns {boolean} True if response body should be captured
   */
  private shouldCaptureResponseBody(resourceType: string, contentType: string): boolean {
    return (
      resourceType !== "image" &&
      resourceType !== "media" &&
      resourceType !== "font" &&
      !contentType.includes("image/") &&
      !contentType.includes("video/") &&
      !contentType.includes("audio/") &&
      !contentType.includes("application/octet-stream")
    );
  }

  /**
   * Truncate response body if it exceeds size limit
   * @param {string} responseBody - The response body content
   * @returns {string} Truncated response body or original if within limit
   */
  private truncateResponseBody(responseBody: string): string {
    return responseBody.length > config.limits.maxResponseBodySize
      ? responseBody.substring(0, config.limits.maxResponseBodySize) + "\n... [Response body truncated - too large]"
      : responseBody;
  }
}