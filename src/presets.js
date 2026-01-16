/**
 * Presets and defaults for Permit.io setup
 * Centralized configuration to avoid hardcoded values across the codebase
 */

/**
 * Validation patterns for keys and identifiers
 */
export const VALIDATION_PATTERNS = {
  // Pattern for resource, role, and user set keys
  key: /^[a-z][a-z0-9_-]*$/,
  keyDescription: 'Key must start with lowercase letter and contain only lowercase letters, numbers, hyphens, or underscores',
};

/**
 * Available actions for resources
 */
export const AVAILABLE_ACTIONS = [
  { name: 'create - Create new items', value: 'create', checked: true },
  { name: 'read - View/read items', value: 'read', checked: true },
  { name: 'update - Modify existing items', value: 'update', checked: true },
  { name: 'delete - Remove items', value: 'delete', checked: true },
  { name: 'list - List all items', value: 'list', checked: true },
  { name: 'manage - Full management access', value: 'manage' },
  { name: 'configure - Configuration access', value: 'configure' },
  { name: 'monitor - Monitoring access', value: 'monitor' },
];

/**
 * Condition operators for ABAC
 */
export const CONDITION_OPERATORS = [
  { name: 'array_contains - Array contains value', value: 'array_contains' },
  { name: 'equals - Exact match', value: 'equals' },
  { name: 'not_equals - Does not equal', value: 'not_equals' },
  { name: 'contains - String contains', value: 'contains' },
  { name: 'starts_with - String starts with', value: 'starts_with' },
  { name: 'ends_with - String ends with', value: 'ends_with' },
];

/**
 * Attribute types for user attributes
 */
export const ATTRIBUTE_TYPES = [
  { name: 'string - Text value', value: 'string' },
  { name: 'number - Numeric value', value: 'number' },
  { name: 'bool - True/false value', value: 'bool' },
  { name: 'array - List of values', value: 'array' },
];

/**
 * System/protected resources that should not be deleted
 */
export const PROTECTED_RESOURCES = ['__user'];

/**
 * System/protected roles that should not be deleted
 */
export const PROTECTED_ROLES = ['admin', 'viewer'];

/**
 * Default tenant name
 */
export const DEFAULT_TENANT = 'default';

/**
 * Default user attribute for ABAC
 */
export const DEFAULT_USER_ATTRIBUTE = {
  key: 'department',
  type: 'string',
  description: 'User department for attribute-based access control',
};

/**
 * API configuration
 */
export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  healthCheckTimeout: 5000, // 5 seconds
  healthCheckKeywords: ['healthy', 'ok'],
};

/**
 * Logger configuration
 */
export const LOGGER_CONFIG = {
  headerWidth: 46,
};

/**
 * Condition set types
 */
export const CONDITION_SET_TYPES = {
  USER_SET: 'userset',
  RESOURCE_SET: 'resourceset',
};

/**
 * Helper to validate a key against the standard pattern
 * @param {string} value - The key to validate
 * @returns {true|string} - True if valid, error message if invalid
 */
export function validateKey(value) {
  if (!value.trim()) return 'Key is required';
  if (!VALIDATION_PATTERNS.key.test(value)) {
    return VALIDATION_PATTERNS.keyDescription;
  }
  return true;
}

/**
 * Helper to capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Helper to generate display name from key
 * @param {string} key - The key to convert
 * @returns {string} - Display name
 */
export function keyToDisplayName(key) {
  return capitalize(key.replace(/-/g, ' '));
}
