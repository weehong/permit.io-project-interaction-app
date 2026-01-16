import { config } from './config.js';
import { logger } from './logger.js';
import { permitApi } from './api.js';

/**
 * Create a resource in Permit.io
 * @param {object} resource - Resource object with key, name, description, actions
 * @returns {Promise<boolean>} True if successful
 */
export async function createResource(resource) {
  logger.info(`Creating resource: ${resource.key}`);
  const result = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/resources`,
    resource
  );

  if (result.success) {
    logger.success(`Resource '${resource.key}' created/exists`);
    return true;
  } else {
    logger.warning(`Failed to create resource '${resource.key}'`);
    return false;
  }
}

/**
 * Get a resource by key
 * @param {string} resourceKey - The resource key
 * @returns {Promise<object|null>} The resource data or null
 */
export async function getResource(resourceKey) {
  const result = await permitApi(
    'GET',
    `/schema/${config.projectId}/${config.envId}/resources/${resourceKey}`
  );
  return result.success ? result.data : null;
}

/**
 * List all resources
 * @returns {Promise<Array>} List of resources
 */
export async function listResources() {
  const result = await permitApi(
    'GET',
    `/schema/${config.projectId}/${config.envId}/resources`
  );
  return result.success ? result.data : [];
}

/**
 * Delete a resource by key
 * @param {string} resourceKey - The resource key
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteResource(resourceKey) {
  const result = await permitApi(
    'DELETE',
    `/schema/${config.projectId}/${config.envId}/resources/${resourceKey}`
  );
  return result.success || result.status === 404;
}
