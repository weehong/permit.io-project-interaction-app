#!/usr/bin/env node

import { input, confirm, select } from '@inquirer/prompts';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { permitApi } from './api.js';
import { createResource } from './resources.js';
import { createUserSet, createSetRule, listConditionSets, listSetRules, createUserAttributes } from './abac.js';
import {
  CONDITION_OPERATORS,
  USER_ATTRIBUTES,
  validateKey,
  keyToDisplayName,
} from './presets.js';

/**
 * Horaion Project - Permit.io ABAC Setup
 *
 * This script configures Permit.io for the Horaion application using pure ABAC
 * (Attribute-Based Access Control) WITHOUT syncing users.
 *
 * Key Design:
 * - Users are NOT synced to Permit.io
 * - Cognito groups are passed as `user.groups` attribute at check time
 * - User Sets match users based on `user.groups array_contains "<group>"`
 * - Set Rules grant permissions to User Sets
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Resources and their actions
 */
const RESOURCES = [
  { key: 'company', name: 'Company', description: 'Company management', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'branch', name: 'Branch', description: 'Branch management', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'department', name: 'Department', description: 'Department management', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'employee', name: 'Employee', description: 'Employee management', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'rule', name: 'Rule', description: 'Rule management', actions: ['create', 'read', 'update', 'delete'] },
];

/**
 * User Sets - ABAC condition sets that match users based on attributes
 *
 * IMPORTANT: Use `user.groups` (not `subject.groups`) for attributes passed at check time
 */
const USER_SETS = [
  {
    key: 'system-administrators',
    name: 'System Administrators',
    description: 'Users with system-administrator group - Full system access',
    conditions: {
      allOf: [{ 'user.groups': { array_contains: 'system-administrator' } }],
    },
  },
  {
    key: 'system-owners',
    name: 'System Owners',
    description: 'Users with system-owner group - Organization owner access',
    conditions: {
      allOf: [{ 'user.groups': { array_contains: 'system-owner' } }],
    },
  },
  {
    key: 'privileged-system-users',
    name: 'Privileged System Users',
    description: 'Users with privileged-system-user group - Elevated access',
    conditions: {
      allOf: [{ 'user.groups': { array_contains: 'privileged-system-user' } }],
    },
  },
  {
    key: 'users',
    name: 'Users',
    description: 'Users with user group - Basic access',
    conditions: {
      allOf: [{ 'user.groups': { array_contains: 'user' } }],
    },
  },
];

/**
 * Set Rules - Permissions granted to User Sets
 *
 * Format: { userSet, resource, actions[] }
 */
const SET_RULES = [
  // System Administrators - Full access to everything
  { userSet: 'system-administrators', resource: 'company', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-administrators', resource: 'branch', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-administrators', resource: 'department', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-administrators', resource: 'employee', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-administrators', resource: 'rule', actions: ['create', 'read', 'update', 'delete'] },

  // System Owners - Full access to company, branch, department, employee
  { userSet: 'system-owners', resource: 'company', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-owners', resource: 'branch', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-owners', resource: 'department', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-owners', resource: 'employee', actions: ['create', 'read', 'update', 'delete'] },
  { userSet: 'system-owners', resource: 'rule', actions: ['read'] },

  // Privileged System Users - CRUD on employee, read on others
  { userSet: 'privileged-system-users', resource: 'company', actions: ['read'] },
  { userSet: 'privileged-system-users', resource: 'branch', actions: ['read'] },
  { userSet: 'privileged-system-users', resource: 'department', actions: ['read'] },
  { userSet: 'privileged-system-users', resource: 'employee', actions: ['create', 'read', 'update'] },
  { userSet: 'privileged-system-users', resource: 'rule', actions: ['read'] },

  // Basic Users - Read access only
  { userSet: 'users', resource: 'company', actions: ['read'] },
  { userSet: 'users', resource: 'branch', actions: ['read'] },
  { userSet: 'users', resource: 'department', actions: ['read'] },
  { userSet: 'users', resource: 'employee', actions: ['read'] },
  { userSet: 'users', resource: 'rule', actions: ['read'] },
];

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

/**
 * Create or update a User Set
 */
async function createOrUpdateUserSet(userSet) {
  // First try to create
  const createResult = await permitApi(
    'POST',
    `/schema/${config.projectId}/${config.envId}/condition_sets`,
    { ...userSet, type: 'userset' }
  );

  if (createResult.success) {
    logger.success(`  Created user set: ${userSet.key}`);
    return true;
  }

  // If exists (409), update it
  if (createResult.status === 409) {
    const updateResult = await permitApi(
      'PATCH',
      `/schema/${config.projectId}/${config.envId}/condition_sets/${userSet.key}`,
      { conditions: userSet.conditions }
    );

    if (updateResult.success) {
      logger.success(`  Updated user set: ${userSet.key}`);
      return true;
    }
  }

  logger.warning(`  Failed to create/update user set: ${userSet.key}`);
  return false;
}

/**
 * Prompt user to add custom user sets interactively
 */
async function addCustomUserSets() {
  logger.info('Add Custom User Sets');
  logger.blank();

  let addMore = true;
  const customUserSets = [];

  while (addMore) {
    // Get user set key
    const key = await input({
      message: 'User set key (lowercase, e.g., "managers"):',
      validate: validateKey,
    });

    // Get display name
    const displayName = await input({
      message: 'Display name:',
      default: keyToDisplayName(key),
    });

    // Get description
    const description = await input({
      message: 'Description:',
      default: `Users in ${displayName} set`,
    });

    // Get condition attribute
    let attribute = await select({
      message: 'User attribute to match:',
      choices: USER_ATTRIBUTES,
    });

    // Handle custom attribute
    if (attribute === '__custom__') {
      attribute = await input({
        message: 'Enter custom attribute name:',
        validate: (value) => {
          if (!value.trim()) return 'Attribute name is required';
          return true;
        },
      });
    }

    // Get condition operator
    const operator = await select({
      message: 'Condition operator:',
      choices: CONDITION_OPERATORS,
    });

    // Get condition value
    const conditionValue = await input({
      message: 'Value to match:',
      validate: (value) => {
        if (!value.trim()) return 'Value is required';
        return true;
      },
    });

    // Build the user set
    const userSet = {
      key,
      name: displayName,
      description,
      conditions: {
        allOf: [{ [`user.${attribute}`]: { [operator]: conditionValue } }],
      },
    };

    customUserSets.push(userSet);

    // Show summary
    logger.blank();
    logger.info('User Set Summary:');
    console.log(`  Key: ${key}`);
    console.log(`  Name: ${displayName}`);
    console.log(`  Condition: user.${attribute} ${operator} "${conditionValue}"`);
    logger.blank();

    addMore = await confirm({
      message: 'Add another custom user set?',
      default: false,
    });

    logger.blank();
  }

  // Create the custom user sets
  if (customUserSets.length > 0) {
    logger.info('Creating custom user sets...');
    for (const userSet of customUserSets) {
      await createOrUpdateUserSet(userSet);
    }
    logger.success(`Created ${customUserSets.length} custom user set(s)`);
  }

  return customUserSets;
}

/**
 * Setup resources
 */
async function setupResources() {
  logger.info('Setting up resources...');

  for (const resource of RESOURCES) {
    const actions = {};
    for (const action of resource.actions) {
      actions[action] = {
        name: action.charAt(0).toUpperCase() + action.slice(1),
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.name.toLowerCase()}`,
      };
    }

    await createResource({
      key: resource.key,
      name: resource.name,
      description: resource.description,
      actions,
    });
  }

  logger.success('Resources setup complete');
  logger.blank();
}

/**
 * Setup user attributes
 */
async function setupUserAttributes() {
  logger.info('Setting up user attributes...');
  await createUserAttributes();
  logger.blank();
}

/**
 * Setup user sets
 */
async function setupUserSets() {
  logger.info('Setting up user sets (ABAC)...');
  logger.info('Using user.groups for condition matching (NOT subject.groups)');
  logger.blank();

  for (const userSet of USER_SETS) {
    await createOrUpdateUserSet(userSet);
  }

  logger.success('User sets setup complete');
  logger.blank();
}

/**
 * Setup set rules (permissions)
 */
async function setupSetRules() {
  logger.info('Setting up set rules (permissions)...');

  for (const rule of SET_RULES) {
    for (const action of rule.actions) {
      const permission = `${rule.resource}:${action}`;
      const success = await createSetRule(rule.userSet, `__autogen_${rule.resource}`, permission);
      if (success) {
        logger.success(`  ${rule.userSet} -> ${permission}`);
      } else {
        // May already exist, which is fine
        logger.info(`  ${rule.userSet} -> ${permission} (exists or failed)`);
      }
    }
  }

  logger.success('Set rules setup complete');
  logger.blank();
}

/**
 * Verify setup
 */
async function verifySetup() {
  logger.info('Verifying setup...');
  logger.blank();

  // Check user sets
  const conditionSets = await listConditionSets();
  const userSets = conditionSets.filter(cs => cs.type === 'userset');

  logger.info(`User Sets (${userSets.length}):`);
  for (const us of userSets) {
    const condition = JSON.stringify(us.conditions);
    const usesUserGroups = condition.includes('user.groups');
    const status = usesUserGroups ? '(user.groups)' : '(subject.groups - WRONG!)';
    logger.info(`  - ${us.key} ${status}`);
  }
  logger.blank();

  // Check set rules
  const setRules = await listSetRules();
  logger.info(`Set Rules (${setRules.length}):`);
  for (const sr of setRules) {
    logger.info(`  - ${sr.user_set} -> ${sr.permission}`);
  }
  logger.blank();

  // Check for wrong conditions
  const wrongConditions = userSets.filter(us => {
    const condition = JSON.stringify(us.conditions);
    return condition.includes('subject.groups');
  });

  if (wrongConditions.length > 0) {
    logger.warning('WARNING: Some user sets use subject.groups instead of user.groups!');
    logger.warning('These will NOT work with the Horaion application.');
    for (const us of wrongConditions) {
      logger.warning(`  - ${us.key}`);
    }
  } else {
    logger.success('All user sets use correct user.groups condition!');
  }
}

/**
 * Show header
 */
function showHeader() {
  logger.header('Horaion - Permit.io ABAC Setup');
  console.log('');
  console.log('This script configures Permit.io for the Horaion application');
  console.log('using pure ABAC (Attribute-Based Access Control).');
  console.log('');
  console.log('Key Design:');
  console.log('  - Users are NOT synced to Permit.io');
  console.log('  - Cognito groups are passed as user.groups at check time');
  console.log('  - User Sets match users based on user.groups');
  console.log('');
  console.log('Options:');
  console.log('  --verify, -v        Verify current setup only');
  console.log('  --user-sets, -u     Setup predefined user sets only');
  console.log('  --add-user-set, -a  Add custom user set interactively');
  console.log('');
  console.log(`Project: ${config.projectId}`);
  console.log(`Environment: ${config.envId}`);
  console.log(`API URL: ${config.apiUrl}`);
  logger.blank();
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify') || args.includes('-v');
  const userSetsOnly = args.includes('--user-sets') || args.includes('-u');
  const addUserSet = args.includes('--add-user-set') || args.includes('-a');

  try {
    showHeader();
    validateConfig();

    if (verifyOnly) {
      await verifySetup();
    } else if (addUserSet) {
      // Interactive mode to add custom user sets
      await addCustomUserSets();
      await verifySetup();
    } else if (userSetsOnly) {
      await setupUserSets();
      await verifySetup();
    } else {
      await setupResources();
      await setupUserAttributes();
      await setupUserSets();
      await setupSetRules();
      await verifySetup();
    }

    logger.success('Setup complete!');
  } catch (error) {
    logger.error(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

main();
