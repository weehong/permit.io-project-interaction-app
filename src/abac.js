import { config } from './config.js';
import { logger } from './logger.js';
import { permitApi } from './api.js';
import { CONDITION_SET_TYPES } from './presets.js';

/**
 * List all user attributes defined on __user resource
 * @returns {Promise<Array>} List of user attributes
 */
export async function listUserAttributes() {
  const result = await permitApi(
    'GET',
    `/schema/${config.projectId}/${config.envId}/resources/__user/attributes`
  );
  return result.success ? result.data : [];
}

/**
 * Create a single user attribute on __user resource
 * @param {object} attributeConfig - Attribute configuration { key, type, description }
 * @returns {Promise<boolean>} True if successful
 */
export async function createUserAttribute(attributeConfig) {
  logger.info(`Creating user attribute: ${attributeConfig.key}`);

  const result = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/resources/__user/attributes`,
    {
      key: attributeConfig.key,
      type: attributeConfig.type,
      description: attributeConfig.description,
    }
  );

  if (result.success) {
    logger.success(`User attribute '${attributeConfig.key}' created`);
    return true;
  } else {
    logger.warning(`Failed to create user attribute '${attributeConfig.key}'`);
    return false;
  }
}

/**
 * Create a user set (condition set)
 * @param {object} userSet - User set object with key, name, conditions
 * @returns {Promise<boolean>} True if successful
 */
export async function createUserSet(userSet) {
  logger.info(`Creating user set: ${userSet.key}`);
  const result = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/condition_sets`,
    {
      ...userSet,
      type: CONDITION_SET_TYPES.USER_SET,
    }
  );

  if (result.success) {
    logger.success(`User set '${userSet.key}' created/exists`);
    return true;
  } else {
    logger.warning(`Failed to create user set '${userSet.key}'`);
    return false;
  }
}

/**
 * Create a resource set (condition set)
 * @param {object} resourceSet - Resource set object with key, name, resource_id, conditions
 * @returns {Promise<boolean>} True if successful
 */
export async function createResourceSet(resourceSet) {
  logger.info(`Creating resource set: ${resourceSet.key}`);
  const result = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/condition_sets`,
    {
      ...resourceSet,
      type: CONDITION_SET_TYPES.RESOURCE_SET,
    }
  );

  if (result.success) {
    logger.success(`Resource set '${resourceSet.key}' created/exists`);
    return true;
  } else {
    logger.warning(`Failed to create resource set '${resourceSet.key}'`);
    return false;
  }
}

/**
 * Create a set rule
 * @param {string} userSet - User set key
 * @param {string} resourceSet - Resource set key
 * @param {string} permission - Permission string (resource:action)
 * @returns {Promise<boolean>} True if successful
 */
export async function createSetRule(userSet, resourceSet, permission) {
  const result = await permitApi(
    'POST',
    `/facts/${config.projectId}/${config.envId}/set_rules`,
    {
      user_set: userSet,
      resource_set: resourceSet,
      permission: permission,
    }
  );
  return result.success;
}

/**
 * List all condition sets (user sets and resource sets)
 * @returns {Promise<Array>} List of condition sets
 */
export async function listConditionSets() {
  const result = await permitApi(
    'GET',
    `/schema/${config.projectId}/${config.envId}/condition_sets`
  );
  return result.success ? result.data : [];
}

/**
 * List all set rules
 * @returns {Promise<Array>} List of set rules
 */
export async function listSetRules() {
  const result = await permitApi(
    'GET',
    `/facts/${config.projectId}/${config.envId}/set_rules`
  );
  return result.success ? result.data : [];
}
