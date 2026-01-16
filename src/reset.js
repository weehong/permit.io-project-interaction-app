import { config } from './config.js';
import { logger } from './logger.js';
import { permitApi } from './api.js';
import { listResources, deleteResource } from './resources.js';
import { listRoles } from './roles.js';
import { listConditionSets } from './abac.js';
import {
  PROTECTED_RESOURCES,
  PROTECTED_ROLES,
  DEFAULT_TENANT,
  DEFAULT_USER_ATTRIBUTE,
  CONDITION_SET_TYPES,
} from './presets.js';

/**
 * Delete all set rules
 */
async function deleteSetRules() {
  logger.info('Deleting set rules...');

  const result = await permitApi(
    'GET',
    `/facts/${config.projectId}/${config.envId}/set_rules`
  );

  if (!result.success || !result.data) {
    logger.warning('Could not retrieve set rules');
    return;
  }

  const rules = result.data;
  let deleted = 0;

  for (const rule of rules) {
    const deleteResult = await permitApi(
      'DELETE',
      `/facts/${config.projectId}/${config.envId}/set_rules`,
      {
        user_set: rule.user_set,
        resource_set: rule.resource_set,
        permission: rule.permission,
      }
    );

    if (deleteResult.success) {
      deleted++;
    }
  }

  logger.success(`  Deleted ${deleted} set rules`);
}

/**
 * Delete all condition sets (user sets and resource sets)
 */
async function deleteConditionSets() {
  logger.info('Deleting condition sets...');

  const conditionSets = await listConditionSets();

  if (!conditionSets || conditionSets.length === 0) {
    logger.info('  No condition sets found');
    return;
  }

  // Delete resource sets first
  const resourceSets = conditionSets.filter((cs) => cs.type === CONDITION_SET_TYPES.RESOURCE_SET);
  for (const rs of resourceSets) {
    logger.info(`  Deleting resource set: ${rs.key}`);
    const result = await permitApi(
      'DELETE',
      `/schema/${config.projectId}/${config.envId}/condition_sets/${rs.key}`
    );

    if (result.success) {
      logger.success(`  Resource set '${rs.key}' deleted`);
    } else if (result.status === 404) {
      logger.info(`  Resource set '${rs.key}' not found (already deleted)`);
    } else {
      logger.warning(`  Failed to delete resource set '${rs.key}'`);
    }
  }

  // Delete user sets
  const userSets = conditionSets.filter((cs) => cs.type === CONDITION_SET_TYPES.USER_SET);
  for (const us of userSets) {
    logger.info(`  Deleting user set: ${us.key}`);
    const result = await permitApi(
      'DELETE',
      `/schema/${config.projectId}/${config.envId}/condition_sets/${us.key}`
    );

    if (result.success) {
      logger.success(`  User set '${us.key}' deleted`);
    } else if (result.status === 404) {
      logger.info(`  User set '${us.key}' not found (already deleted)`);
    } else {
      logger.warning(`  Failed to delete user set '${us.key}'`);
    }
  }

  logger.success('Condition sets deleted');
}

/**
 * Delete user attributes
 * @param {string} attributeKey - Attribute key to delete (defaults to DEFAULT_USER_ATTRIBUTE.key)
 */
async function deleteUserAttributes(attributeKey = DEFAULT_USER_ATTRIBUTE.key) {
  logger.info('Deleting user attributes...');

  logger.info(`  Deleting '${attributeKey}' attribute from __user`);
  const result = await permitApi(
    'DELETE',
    `/schema/${config.projectId}/${config.envId}/resources/__user/attributes/${attributeKey}`
  );

  if (result.success) {
    logger.success(`  Attribute '${attributeKey}' deleted`);
  } else if (result.status === 404) {
    logger.info(`  Attribute '${attributeKey}' not found (already deleted)`);
  } else {
    logger.warning(`  Failed to delete '${attributeKey}' attribute`);
  }

  logger.success('User attributes deleted');
}

/**
 * Delete all roles (fetched dynamically from API)
 */
async function deleteRoles() {
  logger.info('Deleting roles...');

  const roles = await listRoles();

  if (!roles || roles.length === 0) {
    logger.info('  No roles found');
    return;
  }

  for (const role of roles) {
    // Skip built-in/protected roles
    if (PROTECTED_ROLES.includes(role.key)) {
      logger.info(`  Skipping built-in role: ${role.key}`);
      continue;
    }

    logger.info(`  Deleting role: ${role.key}`);
    const result = await permitApi(
      'DELETE',
      `/schema/${config.projectId}/${config.envId}/roles/${role.key}`
    );

    if (result.success) {
      logger.success(`  Role '${role.key}' deleted`);
    } else if (result.status === 404) {
      logger.info(`  Role '${role.key}' not found (already deleted)`);
    } else {
      logger.warning(`  Failed to delete role '${role.key}'`);
    }
  }

  logger.success('All roles deleted');
}

/**
 * Delete all resources (fetched dynamically from API)
 */
async function deleteResources() {
  logger.info('Deleting resources...');

  const resources = await listResources();

  if (!resources || resources.length === 0) {
    logger.info('  No resources found');
    return;
  }

  for (const resource of resources) {
    // Skip built-in/protected resources
    if (PROTECTED_RESOURCES.includes(resource.key)) {
      logger.info(`  Skipping built-in resource: ${resource.key}`);
      continue;
    }

    logger.info(`  Deleting resource: ${resource.key}`);
    const success = await deleteResource(resource.key);

    if (success) {
      logger.success(`  Resource '${resource.key}' deleted`);
    } else {
      logger.warning(`  Failed to delete resource '${resource.key}'`);
    }
  }

  logger.success('All resources deleted');
}

/**
 * Delete default tenant
 * @param {string} tenantKey - Tenant key to delete (defaults to DEFAULT_TENANT)
 */
async function deleteDefaultTenant(tenantKey = DEFAULT_TENANT) {
  logger.info('Deleting default tenant...');

  const result = await permitApi(
    'DELETE',
    `/facts/${config.projectId}/${config.envId}/tenants/${tenantKey}`
  );

  if (result.success) {
    logger.success(`Default tenant '${tenantKey}' deleted`);
  } else if (result.status === 404) {
    logger.info(`Default tenant '${tenantKey}' not found (already deleted)`);
  } else {
    logger.warning('Could not delete default tenant');
  }
}

/**
 * Reset/remove all Permit.io configuration
 */
export async function resetAll() {
  logger.info('Resetting all Permit.io configuration...');
  logger.blank();

  await deleteSetRules();
  logger.blank();

  await deleteConditionSets();
  logger.blank();

  await deleteUserAttributes();
  logger.blank();

  await deleteRoles();
  logger.blank();

  await deleteResources();
  logger.blank();

  await deleteDefaultTenant();
  logger.blank();

  logger.success('All Permit.io configuration has been reset!');
}

/**
 * Reset RBAC only (resources, roles)
 */
export async function resetRbac() {
  logger.info('Resetting RBAC configuration...');
  logger.blank();

  await deleteRoles();
  logger.blank();

  await deleteResources();
  logger.blank();

  logger.success('RBAC configuration has been reset!');
}

/**
 * Reset ABAC only (user attributes, user sets, resource sets, set rules)
 */
export async function resetAbac() {
  logger.info('Resetting ABAC configuration...');
  logger.blank();

  await deleteSetRules();
  logger.blank();

  await deleteConditionSets();
  logger.blank();

  await deleteUserAttributes();
  logger.blank();

  logger.success('ABAC configuration has been reset!');
}

/**
 * Reset resources only
 */
export async function resetResources() {
  logger.info('Resetting resources...');
  logger.blank();

  await deleteResources();
  logger.blank();

  logger.success('Resources have been reset!');
}

/**
 * Reset roles only
 */
export async function resetRoles() {
  logger.info('Resetting roles...');
  logger.blank();

  await deleteRoles();
  logger.blank();

  logger.success('Roles have been reset!');
}
