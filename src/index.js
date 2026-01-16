#!/usr/bin/env node

import { select, confirm, input, checkbox } from '@inquirer/prompts';
import { Command } from 'commander';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { checkEdgePdpHealth } from './api.js';
import { createResource, listResources, getResource } from './resources.js';
import { createRole, listRoles, assignPermissionToRole } from './roles.js';
import { createUserSet, createResourceSet, listConditionSets, listUserAttributes, createUserAttribute } from './abac.js';
import { verifySetup } from './verify.js';
import { resetAll, resetAbac, resetResources, resetRoles } from './reset.js';
import {
  AVAILABLE_ACTIONS,
  CONDITION_OPERATORS,
  ATTRIBUTE_TYPES,
  PROTECTED_RESOURCES,
  validateKey,
  keyToDisplayName,
  capitalize,
} from './presets.js';

/**
 * Show application header
 */
function showHeader() {
  logger.header('Permit.io Edge PDP Setup (ABAC)');
  console.log(`Project: ${config.projectId}`);
  console.log(`Environment: ${config.envId}`);
  console.log(`Cloud API: ${config.apiUrl}`);
  console.log(`Edge PDP: ${config.pdpUrl}`);
  logger.blank();
}

/**
 * Check Edge PDP connectivity
 */
async function checkEdgePdp() {
  logger.info('Checking Edge PDP connectivity...');

  const isHealthy = await checkEdgePdpHealth();

  if (isHealthy) {
    logger.success(`Edge PDP is running at ${config.pdpUrl}`);
    return true;
  } else {
    logger.warning(`Edge PDP may not be running at ${config.pdpUrl}`);
    logger.blank();
    console.log('To start Edge PDP, run:');
    console.log('  docker compose -f deployments/compose.yaml up permit-pdp -d');
    logger.blank();
    console.log('ABAC with User Sets REQUIRES Edge PDP!');
    console.log('Cloud PDP (https://cloudpdp.api.permit.io) does NOT support ABAC.');
    logger.blank();

    const shouldContinue = await confirm({
      message: 'Continue anyway?',
      default: false,
    });

    if (!shouldContinue) {
      logger.error('Setup cancelled. Please start Edge PDP first.');
      process.exit(1);
    }

    return false;
  }
}

/**
 * Prompt user for resource details and create it
 */
async function runCreateResource() {
  logger.info('Create Resource');
  logger.blank();

  // Get resource key
  const key = await input({
    message: 'Resource key (lowercase, no spaces, e.g., "invoice"):',
    validate: validateKey,
  });

  // Get resource name
  const name = await input({
    message: 'Resource name (display name, e.g., "Invoice"):',
    default: keyToDisplayName(key),
    validate: (value) => value.trim() ? true : 'Resource name is required',
  });

  // Get resource description
  const description = await input({
    message: 'Resource description:',
    default: `${name} resource`,
  });

  // Select actions
  const selectedActions = await checkbox({
    message: 'Select actions for this resource:',
    choices: AVAILABLE_ACTIONS,
    required: true,
    validate: (value) => value.length > 0 ? true : 'Select at least one action',
  });

  // Build actions object
  const actions = {};
  for (const action of selectedActions) {
    const actionName = capitalize(action);
    actions[action] = {
      name: actionName,
      description: `${actionName} ${name.toLowerCase()}`,
    };
  }

  // Allow custom actions
  const addCustomActions = await confirm({
    message: 'Do you want to add custom actions?',
    default: false,
  });

  if (addCustomActions) {
    let addMore = true;
    while (addMore) {
      const customActionKey = await input({
        message: 'Custom action key (e.g., "approve"):',
        validate: validateKey,
      });

      const customActionName = await input({
        message: 'Custom action name:',
        default: capitalize(customActionKey),
      });

      const customActionDesc = await input({
        message: 'Custom action description:',
        default: `${customActionName} ${name.toLowerCase()}`,
      });

      actions[customActionKey] = {
        name: customActionName,
        description: customActionDesc,
      };

      addMore = await confirm({
        message: 'Add another custom action?',
        default: false,
      });
    }
  }

  // Show summary
  logger.blank();
  logger.info('Resource Summary:');
  console.log(`  Key: ${key}`);
  console.log(`  Name: ${name}`);
  console.log(`  Description: ${description}`);
  console.log(`  Actions: ${Object.keys(actions).join(', ')}`);
  logger.blank();

  const confirmCreate = await confirm({
    message: 'Create this resource?',
    default: true,
  });

  if (!confirmCreate) {
    logger.info('Resource creation cancelled.');
    return;
  }

  logger.blank();
  await createResource({ key, name, description, actions });
}

/**
 * Prompt user for role details and create it
 */
async function runCreateRole() {
  logger.info('Create Role');
  logger.blank();

  // Get role key
  const key = await input({
    message: 'Role key (lowercase, no spaces, e.g., "admin"):',
    validate: validateKey,
  });

  // Get role name
  const name = await input({
    message: 'Role name (display name, e.g., "Administrator"):',
    default: keyToDisplayName(key),
    validate: (value) => value.trim() ? true : 'Role name is required',
  });

  // Get role description
  const description = await input({
    message: 'Role description:',
    default: `${name} role`,
  });

  // Show summary
  logger.blank();
  logger.info('Role Summary:');
  console.log(`  Key: ${key}`);
  console.log(`  Name: ${name}`);
  console.log(`  Description: ${description}`);
  logger.blank();

  const confirmCreate = await confirm({
    message: 'Create this role?',
    default: true,
  });

  if (!confirmCreate) {
    logger.info('Role creation cancelled.');
    return;
  }

  logger.blank();
  const success = await createRole({ key, name, description });

  // Ask if user wants to assign permissions
  if (success) {
    const assignPerms = await confirm({
      message: 'Do you want to assign permissions to this role?',
      default: false,
    });

    if (assignPerms) {
      const resources = await listResources();
      const filteredResources = resources.filter(r => !PROTECTED_RESOURCES.includes(r.key));

      if (filteredResources.length === 0) {
        logger.warning('No resources found. Create resources first to assign permissions.');
        return;
      }

      let addMore = true;
      while (addMore) {
        const resourceChoices = filteredResources.map(r => ({
          name: `${r.key} - ${r.name}`,
          value: r.key,
        }));

        const selectedResource = await select({
          message: 'Select resource:',
          choices: resourceChoices,
        });

        const resource = filteredResources.find(r => r.key === selectedResource);
        const actionChoices = Object.keys(resource.actions || {}).map(a => ({
          name: a,
          value: a,
        }));

        if (actionChoices.length === 0) {
          logger.warning(`No actions found for resource '${selectedResource}'.`);
        } else {
          const selectedActions = await checkbox({
            message: `Select actions for ${selectedResource}:`,
            choices: actionChoices,
          });

          for (const action of selectedActions) {
            const permSuccess = await assignPermissionToRole(key, selectedResource, action);
            if (permSuccess) {
              logger.success(`  Assigned ${selectedResource}:${action} to ${key}`);
            }
          }
        }

        addMore = await confirm({
          message: 'Assign more permissions?',
          default: false,
        });
      }
    }
  }
}

/**
 * Prompt user for user attribute details and create it
 */
async function runCreateUserAttribute() {
  logger.info('Create User Attribute');
  logger.blank();

  // Get attribute key
  const key = await input({
    message: 'Attribute key (lowercase, e.g., "department"):',
    validate: validateKey,
  });

  // Get attribute type
  const type = await select({
    message: 'Attribute type:',
    choices: ATTRIBUTE_TYPES,
  });

  // Get attribute description
  const description = await input({
    message: 'Attribute description:',
    default: `${keyToDisplayName(key)} attribute for ABAC`,
  });

  // Show summary
  logger.blank();
  logger.info('User Attribute Summary:');
  console.log(`  Key: ${key}`);
  console.log(`  Type: ${type}`);
  console.log(`  Description: ${description}`);
  logger.blank();

  const confirmCreate = await confirm({
    message: 'Create this user attribute?',
    default: true,
  });

  if (!confirmCreate) {
    logger.info('User attribute creation cancelled.');
    return;
  }

  logger.blank();
  await createUserAttribute({ key, type, description });
}

/**
 * Prompt user for user set details and create it
 */
async function runCreateUserSet() {
  logger.info('Create User Set (ABAC)');
  logger.blank();

  // Fetch existing user attributes from API
  logger.info('Fetching available user attributes...');
  const customAttributes = await listUserAttributes();

  // Build attribute choices: built-in attributes + custom attributes
  const builtInAttributes = [
    { name: 'email - User email address (built-in)', value: 'email' },
    { name: 'key - User key/ID (built-in)', value: 'key' },
  ];

  const customAttributeChoices = customAttributes.map(attr => ({
    name: `${attr.key} - ${attr.description || attr.type} (custom)`,
    value: attr.key,
  }));

  const allAttributeChoices = [...builtInAttributes, ...customAttributeChoices];

  if (allAttributeChoices.length === 2 && customAttributeChoices.length === 0) {
    logger.warning('No custom user attributes found.');
    logger.info('You can create custom attributes using "Create User Attribute" option.');
    logger.blank();
  }

  // Get user set key
  const key = await input({
    message: 'User set key (lowercase, e.g., "admins"):',
    validate: validateKey,
  });

  // Get user set name
  const name = await input({
    message: 'User set name (display name):',
    default: keyToDisplayName(key),
    validate: (value) => value.trim() ? true : 'User set name is required',
  });

  // Get condition attribute
  const attribute = await select({
    message: 'User attribute to match:',
    choices: allAttributeChoices,
  });

  // Get condition operator
  const operator = await select({
    message: 'Condition operator:',
    choices: CONDITION_OPERATORS,
  });

  // Get condition value
  const conditionValue = await input({
    message: 'Value to match:',
    validate: (value) => value.trim() ? true : 'Value is required',
  });

  // Build conditions
  const conditions = {
    allOf: [{ [`user.${attribute}`]: { [operator]: conditionValue } }],
  };

  // Show summary
  logger.blank();
  logger.info('User Set Summary:');
  console.log(`  Key: ${key}`);
  console.log(`  Name: ${name}`);
  console.log(`  Condition: user.${attribute} ${operator} "${conditionValue}"`);
  logger.blank();

  const confirmCreate = await confirm({
    message: 'Create this user set?',
    default: true,
  });

  if (!confirmCreate) {
    logger.info('User set creation cancelled.');
    return;
  }

  logger.blank();
  await createUserSet({ key, name, conditions });
}

/**
 * Prompt user for resource set details and create it
 */
async function runCreateResourceSet() {
  logger.info('Create Resource Set (ABAC)');
  logger.blank();

  // Get available resources (filter out protected/system resources)
  const resources = await listResources();
  const filteredResources = resources.filter(r => !PROTECTED_RESOURCES.includes(r.key));

  if (filteredResources.length === 0) {
    logger.warning('No resources found. Create resources first.');
    return;
  }

  // Select resource
  const resourceChoices = filteredResources.map(r => ({
    name: `${r.key} - ${r.name}`,
    value: r.key,
  }));

  const selectedResourceKey = await select({
    message: 'Select resource for this resource set:',
    choices: resourceChoices,
  });

  const selectedResource = filteredResources.find(r => r.key === selectedResourceKey);

  // Get resource set key
  const key = await input({
    message: 'Resource set key (e.g., "all-invoices"):',
    default: `all-${selectedResourceKey}s`,
    validate: validateKey,
  });

  // Get resource set name
  const name = await input({
    message: 'Resource set name:',
    default: `All ${selectedResource.name}s`,
    validate: (value) => value.trim() ? true : 'Resource set name is required',
  });

  // Show summary
  logger.blank();
  logger.info('Resource Set Summary:');
  console.log(`  Key: ${key}`);
  console.log(`  Name: ${name}`);
  console.log(`  Resource: ${selectedResourceKey}`);
  console.log(`  Conditions: All ${selectedResourceKey} resources (no filter)`);
  logger.blank();

  const confirmCreate = await confirm({
    message: 'Create this resource set?',
    default: true,
  });

  if (!confirmCreate) {
    logger.info('Resource set creation cancelled.');
    return;
  }

  logger.blank();
  await createResourceSet({
    key,
    name,
    resource_id: selectedResource.id,
    conditions: { allOf: [] },
  });
}

/**
 * Run verify setup
 */
async function runVerify() {
  logger.info('Running: Verify Setup');
  logger.blank();
  await verifySetup();
}

/**
 * Run reset all (remove everything)
 */
async function runResetAll() {
  const confirmed = await confirm({
    message: 'This will DELETE all resources, roles, user sets, resource sets, and set rules. Are you sure?',
    default: false,
  });

  if (!confirmed) {
    logger.info('Reset cancelled.');
    return;
  }

  logger.blank();
  await resetAll();
}

/**
 * Run reset ABAC only
 */
async function runResetAbac() {
  const confirmed = await confirm({
    message: 'This will DELETE all user attributes, user sets, resource sets, and set rules. Are you sure?',
    default: false,
  });

  if (!confirmed) {
    logger.info('Reset cancelled.');
    return;
  }

  logger.blank();
  await resetAbac();
}

/**
 * Run reset resources only
 */
async function runResetResources() {
  const confirmed = await confirm({
    message: 'This will DELETE all resources. Are you sure?',
    default: false,
  });

  if (!confirmed) {
    logger.info('Reset cancelled.');
    return;
  }

  logger.blank();
  await resetResources();
}

/**
 * Run reset roles only
 */
async function runResetRoles() {
  const confirmed = await confirm({
    message: 'This will DELETE all roles. Are you sure?',
    default: false,
  });

  if (!confirmed) {
    logger.info('Reset cancelled.');
    return;
  }

  logger.blank();
  await resetRoles();
}

/**
 * Show How-to Guide for ABAC setup
 */
async function showHowTo() {
  logger.header('How to Set Up ABAC with Permit.io');
  logger.blank();

  console.log('ABAC (Attribute-Based Access Control) allows you to define access rules');
  console.log('based on user attributes rather than just roles.');
  logger.blank();

  logger.info('=== Setup Order (Follow These Steps) ===');
  logger.blank();

  console.log('STEP 1: Create a Resource');
  console.log('   - Define what you want to protect (e.g., "invoice", "document")');
  console.log('   - Add actions like: create, read, update, delete');
  console.log('   Example: Resource "invoice" with actions: read, create, delete');
  logger.blank();

  console.log('STEP 2: Create User Attribute(s)');
  console.log('   - Define custom attributes on users (e.g., "department", "groups")');
  console.log('   - Choose the right type:');
  console.log('     * string  - Single text value (e.g., department: "engineering")');
  console.log('     * number  - Numeric value (e.g., level: 5)');
  console.log('     * bool    - True/false (e.g., is_manager: true)');
  console.log('     * array   - List of values (e.g., groups: ["admin", "billing"])');
  console.log('   Example: Attribute "groups" with type "array"');
  logger.blank();

  console.log('STEP 3: Create User Set(s)');
  console.log('   - Define conditions to match users based on attributes');
  console.log('   - Uses operators: equals, contains, array_contains, etc.');
  console.log('   Example: User Set "billing-team" where user.groups array_contains "billing"');
  logger.blank();

  console.log('STEP 4: Create Resource Set(s)');
  console.log('   - Define which resources the rule applies to');
  console.log('   - Can match all resources or filter by attributes');
  console.log('   Example: Resource Set "all-invoices" for all invoice resources');
  logger.blank();

  console.log('STEP 5: Set Rules are Created Automatically');
  console.log('   - When you have User Sets and Resource Sets, Permit.io links them');
  console.log('   - You can manage these in the Permit.io dashboard');
  logger.blank();

  logger.info('=== Example: Billing Team Access to Invoices ===');
  logger.blank();
  console.log('Goal: Users with "billing" in their groups can read invoices');
  logger.blank();
  console.log('1. Create Resource: "invoice" with action "read"');
  console.log('2. Create User Attribute: "groups" (type: array)');
  console.log('3. Create User Set: "billing-users"');
  console.log('   Condition: user.groups array_contains "billing"');
  console.log('4. Create Resource Set: "all-invoices" for resource "invoice"');
  console.log('5. In Permit.io dashboard, create Set Rule:');
  console.log('   billing-users + all-invoices + invoice:read');
  logger.blank();

  logger.info('=== Testing with permit.check() ===');
  logger.blank();
  console.log('In your application code:');
  logger.blank();
  console.log('  const permitted = await permit.check(');
  console.log('    {');
  console.log('      key: "user-123",');
  console.log('      attributes: { groups: ["billing", "finance"] }');
  console.log('    },');
  console.log('    "read",');
  console.log('    { type: "invoice", key: "invoice-456" }');
  console.log('  );');
  logger.blank();
  console.log('This checks if user-123 (with groups billing, finance) can read invoice-456.');
  logger.blank();

  logger.info('=== Important Notes ===');
  logger.blank();
  console.log('* ABAC requires Edge PDP - Cloud PDP does not support User Sets');
  console.log('* User attributes must be created BEFORE they can be used in User Sets');
  console.log('* Built-in attributes (email, key) are always available');
  console.log('* Use "Verify Setup" to see your current configuration');
  logger.blank();

  await confirm({
    message: 'Press Enter to return to menu...',
    default: true,
  });
}

/**
 * Interactive menu using inquirer.js
 */
async function showInteractiveMenu() {
  let continueMenu = true;

  while (continueMenu) {
    const choice = await select({
      message: 'Permit.io Setup - Select an option',
      choices: [
        { name: ' ?) How-to Guide (Start Here)', value: 'how-to' },
        { name: ' 1) Create Resource', value: 'create-resource' },
        { name: ' 2) Create Role', value: 'create-role' },
        { name: ' 3) Create User Attribute (ABAC)', value: 'create-user-attribute' },
        { name: ' 4) Create User Set (ABAC)', value: 'create-user-set' },
        { name: ' 5) Create Resource Set (ABAC)', value: 'create-resource-set' },
        { name: ' 6) Verify Setup', value: 'verify' },
        { name: ' 7) Reset All (Delete Everything)', value: 'reset-all' },
        { name: ' 8) Reset Resources Only', value: 'reset-resources' },
        { name: ' 9) Reset Roles Only', value: 'reset-roles' },
        { name: '10) Reset ABAC Only', value: 'reset-abac' },
        { name: ' 0) Exit', value: 'exit' },
      ],
    });

    logger.blank();

    switch (choice) {
      case 'how-to':
        await showHowTo();
        break;
      case 'create-resource':
        await runCreateResource();
        break;
      case 'create-role':
        await runCreateRole();
        break;
      case 'create-user-attribute':
        await runCreateUserAttribute();
        break;
      case 'create-user-set':
        await runCreateUserSet();
        break;
      case 'create-resource-set':
        await runCreateResourceSet();
        break;
      case 'verify':
        await runVerify();
        break;
      case 'reset-all':
        await runResetAll();
        break;
      case 'reset-resources':
        await runResetResources();
        break;
      case 'reset-roles':
        await runResetRoles();
        break;
      case 'reset-abac':
        await runResetAbac();
        break;
      case 'exit':
        logger.info('Exiting...');
        process.exit(0);
    }

    logger.blank();

    continueMenu = await confirm({
      message: 'Run another operation?',
      default: true,
    });

    logger.blank();
  }

  logger.info('Exiting...');
}

/**
 * Main entry point
 */
async function main() {
  const program = new Command();

  program
    .name('permit-setup')
    .description('Permit.io Edge PDP Setup Script (ABAC with User Sets)')
    .version('1.0.0');

  program
    .option('-v, --verify', 'Verify current setup only')
    .option('-r, --reset', 'Reset/delete all configuration')
    .option('--reset-resources', 'Reset/delete resources only')
    .option('--reset-roles', 'Reset/delete roles only')
    .option('--reset-abac', 'Reset/delete ABAC configuration only');

  program.parse();

  const options = program.opts();

  try {
    // Show header
    showHeader();

    // Validate configuration
    validateConfig();

    // Determine run mode
    const hasOption = options.verify || options.reset || options.resetResources || options.resetRoles || options.resetAbac;

    // Run based on options or show interactive menu
    if (options.verify) {
      await runVerify();
    } else if (options.reset) {
      await runResetAll();
    } else if (options.resetResources) {
      await runResetResources();
    } else if (options.resetRoles) {
      await runResetRoles();
    } else if (options.resetAbac) {
      await runResetAbac();
    } else {
      // No options - show interactive menu
      await showInteractiveMenu();
    }
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

main();
