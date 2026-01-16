import { logger } from './logger.js';
import { listResources } from './resources.js';
import { listRoles } from './roles.js';
import { listConditionSets, listSetRules } from './abac.js';

/**
 * Verify the current Permit.io setup
 */
export async function verifySetup() {
  logger.info('Verifying setup...');

  logger.blank();
  logger.info('Roles:');
  try {
    const roles = await listRoles();
    if (roles && roles.length > 0) {
      roles.forEach((role) => {
        console.log(`  - ${role.key}: ${role.name}`);
      });
    } else {
      logger.warning('No roles found');
    }
  } catch {
    logger.warning('Could not list roles');
  }

  logger.blank();
  logger.info('Resources:');
  try {
    const resources = await listResources();
    if (resources && resources.length > 0) {
      resources.forEach((resource) => {
        console.log(`  - ${resource.key}: ${resource.name}`);
      });
    } else {
      logger.warning('No resources found');
    }
  } catch {
    logger.warning('Could not list resources');
  }

  logger.blank();
  logger.info('User Sets:');
  try {
    const conditionSets = await listConditionSets();
    const userSets = conditionSets?.filter((cs) => cs.type === 'userset') || [];
    if (userSets.length > 0) {
      userSets.forEach((us) => {
        console.log(`  - ${us.key}: ${us.name}`);
      });
    } else {
      logger.warning('No user sets found');
    }
  } catch {
    logger.warning('Could not list user sets');
  }

  logger.blank();
  logger.info('Resource Sets:');
  try {
    const conditionSets = await listConditionSets();
    const resourceSets = conditionSets?.filter((cs) => cs.type === 'resourceset') || [];
    if (resourceSets.length > 0) {
      resourceSets.forEach((rs) => {
        console.log(`  - ${rs.key}: ${rs.name}`);
      });
    } else {
      logger.warning('No resource sets found');
    }
  } catch {
    logger.warning('Could not list resource sets');
  }

  logger.blank();
  logger.info('Set Rules:');
  try {
    const rules = await listSetRules();
    const ruleCount = rules?.length ?? '?';
    console.log(`  Total set rules: ${ruleCount}`);
  } catch {
    logger.warning('Could not list set rules');
  }

  logger.blank();
  logger.success('Setup verification complete');
}
