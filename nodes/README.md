# n8n-nodes-ark

Custom n8n community nodes for ARK (Agentic Runtime for Kubernetes).

## Overview

This package provides native n8n nodes for interacting with ARK resources:

- **ARK Agent** - Execute agent queries
- **ARK Model** - Query models directly
- **ARK Team** - Execute team-based multi-agent workflows
- **ARK Evaluation** - Trigger node for evaluation events

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
npm install
```

### Development Workflow

This project follows Test-Driven Development (TDD):

1. **Write tests first** - Create test file in `__tests__/` directory
2. **Watch tests** - `npm run test:watch`
3. **Implement feature** - Write code until tests pass
4. **Lint and fix** - `npm run lintfix`

### Build

```bash
npm run build
```

This will:
1. Compile TypeScript to JavaScript
2. Copy SVG icons to dist directory
3. Generate type declarations

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lintfix
```

## Project Structure

```
nodes/
├── credentials/
│   ├── ArkApi.credentials.ts
│   └── __tests__/
├── nodes/
│   ├── ArkAgent/
│   ├── ArkModel/
│   ├── ArkTeam/
│   └── ArkEvaluation/
├── test-helpers/
│   ├── mocks.ts
│   └── fixtures.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── gulpfile.js
```

## Contributing

1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain >90% code coverage
4. Follow ESLint rules
5. Update documentation

## License

MIT
