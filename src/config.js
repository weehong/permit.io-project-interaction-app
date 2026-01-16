import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the project root
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
}

export const config = {
  // Cloud API URL for schema/policy configuration
  apiUrl: process.env.PERMIT_API_URL || 'https://api.permit.io/v2',

  // Edge PDP URL for authorization checks (ABAC requires Edge PDP!)
  pdpUrl: process.env.PERMIT_PDP_URL || 'http://localhost:7766',

  // API Key (required)
  apiKey: process.env.PERMIT_API_KEY || '',

  // Project and Environment
  projectId: process.env.PERMIT_PROJECT_ID || 'default',
  envId: process.env.PERMIT_ENV_ID || 'dev',
};

export function validateConfig() {
  if (!config.apiKey) {
    throw new Error(
      'PERMIT_API_KEY environment variable is not set.\n' +
      'Please set it with: export PERMIT_API_KEY="your-api-key"\n' +
      'Or add it to the .env file in the project root.'
    );
  }
  return true;
}
