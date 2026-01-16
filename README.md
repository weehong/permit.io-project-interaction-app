# Permit.io RBAC/ABAC Setup CLI

A command-line tool for setting up Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) with [Permit.io](https://permit.io).

## Features

- **Interactive CLI** - Menu-driven interface for creating resources, roles, and ABAC configurations
- **RBAC Setup** - Create resources with custom actions and roles with permissions
- **ABAC Setup** - Create user attributes, user sets, and resource sets for attribute-based access control
- **Horaion Project Support** - Pre-configured setup script for the Horaion application
- **Verification** - Verify your current Permit.io configuration
- **Reset Tools** - Selectively reset resources, roles, or ABAC configurations

## Prerequisites

- Node.js 18+
- A [Permit.io](https://permit.io) account with an API key
- **Edge PDP** (required for ABAC) - Cloud PDP does not support User Sets

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
# Required
PERMIT_API_KEY=your-permit-api-key

# Optional (defaults shown)
PERMIT_API_URL=https://api.permit.io/v2
PERMIT_PDP_URL=http://localhost:7766
PERMIT_PROJECT_ID=default
PERMIT_ENV_ID=dev
```

### Starting Edge PDP

ABAC with User Sets requires Edge PDP. To start it:

```bash
docker run -p 7766:7000 \
  -e PDP_API_KEY=your-permit-api-key \
  permitio/pdp-v2:latest
```

Or use Docker Compose if available:

```bash
docker compose -f deployments/compose.yaml up permit-pdp -d
```

## Usage

### Interactive Mode

```bash
npm start
```

This launches an interactive menu with options to:

1. **How-to Guide** - Step-by-step guide for setting up ABAC
2. **Create Resource** - Define resources with custom actions
3. **Create Role** - Create roles and assign permissions
4. **Create User Attribute** - Define custom user attributes for ABAC
5. **Create User Set** - Create condition-based user sets
6. **Create Resource Set** - Create resource sets for ABAC rules
7. **Verify Setup** - View current configuration
8. **Reset** - Delete configurations (all, resources, roles, or ABAC only)

### CLI Options

```bash
# Verify current setup
npm start -- --verify
npm start -- -v

# Reset all configuration
npm start -- --reset

# Reset specific configurations
npm start -- --reset-resources
npm start -- --reset-roles
npm start -- --reset-abac
```

### Horaion Project Setup

For the Horaion application with pre-configured ABAC:

```bash
# Full setup (resources, user attributes, user sets, set rules)
npm run horaion

# Verify setup only
npm run horaion:verify

# Setup user sets only
npm run horaion:user-sets

# Add custom user set interactively
npm run horaion:add-user-set
```

The Horaion setup creates:
- **Resources**: company, branch, department, employee, rule
- **User Sets**: system-administrators, system-owners, privileged-system-users, users
- **Set Rules**: Permission mappings based on Cognito groups

## ABAC Concepts

### User Attributes

Custom attributes on users (e.g., `department`, `groups`). Types:
- `string` - Single text value
- `number` - Numeric value
- `bool` - True/false
- `array` - List of values

### User Sets

Condition-based groupings of users. Example:

```json
{
  "key": "billing-team",
  "conditions": {
    "allOf": [{ "user.groups": { "array_contains": "billing" } }]
  }
}
```

### Condition Operators

- `equals` - Exact match
- `not_equals` - Does not equal
- `contains` - String contains
- `starts_with` / `ends_with` - String prefix/suffix
- `array_contains` - Array contains value

## Example: Using permit.check()

```javascript
const permitted = await permit.check(
  {
    key: "user-123",
    attributes: { groups: ["billing", "finance"] }
  },
  "read",
  { type: "invoice", key: "invoice-456" }
);
```

## Project Structure

```
src/
├── index.js          # Main CLI entry point
├── horaion-setup.js  # Horaion-specific setup script
├── config.js         # Environment configuration
├── api.js            # Permit.io API client
├── resources.js      # Resource management
├── roles.js          # Role management
├── abac.js           # ABAC (user sets, resource sets)
├── reset.js          # Reset/cleanup functions
├── verify.js         # Configuration verification
├── presets.js        # Constants and defaults
└── logger.js         # Console logging utilities
```

## License

ISC
