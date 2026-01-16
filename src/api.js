import { config } from './config.js';
import { logger } from './logger.js';

const TIMEOUT_MS = 30000;

/**
 * Make an API call to Permit.io
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {object|null} data - Request body data
 * @returns {Promise<object|null>} Response body or null on error
 */
export async function permitApi(method, endpoint, data = null) {
  const url = `${config.apiUrl}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    const body = await response.text();
    let jsonBody = null;
    try {
      jsonBody = body ? JSON.parse(body) : null;
    } catch {
      // Response is not JSON
    }

    if (response.ok) {
      return { success: true, data: jsonBody, status: response.status };
    } else if (response.status === 409) {
      // Resource already exists - not an error
      return { success: true, data: jsonBody, status: response.status, exists: true };
    } else {
      logger.warning(`API call failed with HTTP ${response.status}: ${body}`);
      return { success: false, data: jsonBody, status: response.status };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.error(`API call timed out after ${TIMEOUT_MS}ms`);
    } else {
      logger.error(`API call failed: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Check Edge PDP health
 * @returns {Promise<boolean>} True if PDP is healthy
 */
export async function checkEdgePdpHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.pdpUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    return text.includes('healthy') || text.includes('ok') || response.ok;
  } catch {
    return false;
  }
}
