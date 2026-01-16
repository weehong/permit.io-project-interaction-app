import { config } from './config.js';
import { logger } from './logger.js';
import { permitApi } from './api.js';

/**
 * Create a role in Permit.io
 * @param {object} role - Role object with key, name, description
 * @returns {Promise<boolean>} True if successful
 */
export async function createRole(role) {
  logger.info(`Creating role: ${role.key}`);
  const result = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/roles`,
    role
  );

  if (result.success) {
    logger.success(`Role '${role.key}' created/exists`);
    return true;
  } else {
    logger.warning(`Failed to create role '${role.key}'`);
    return false;
  }
}

/**
 * Assign a permission to a role
 * @param {string} roleKey - The role key
 * @param {string} resource - The resource key
 * @param {string} action - The action key
 * @returns {Promise<boolean>} True if successful
 */
export async function assignPermissionToRole(roleKey, resource, action) {
  const result = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/roles/${roleKey}/permissions`,
    {
      permission: `${resource}:${action}`,
    }
  );
  return result.success;
}

/**
 * List all roles
 * @returns {Promise<Array>} List of roles
 */
export async function listRoles() {
  const result = await permitApi(
    'GET',
    `/schema/${config.projectId}/${config.envId}/roles`
  );
  return result.success ? result.data : [];
}

/**
 * Delete a role by key
 * @param {string} roleKey - The role key
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteRole(roleKey) {
  const result = await permitApi(
    'DELETE',
    `/schema/${config.projectId}/${config.envId}/roles/${roleKey}`
  );
  return result.success || result.status === 404;
}
