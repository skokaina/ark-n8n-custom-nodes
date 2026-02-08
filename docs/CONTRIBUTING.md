# Contributing Guide

## Adding New Nodes

### 1. Create Node File

```
nodes/nodes/YourNode/YourNode.node.ts
```

### 2. Implement INodeType Interface

```typescript
import { INodeType, INodeTypeDescription, IExecuteFunctions } from 'n8n-workflow';

export class YourNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Your Node',
    name: 'yourNode',
    group: ['transform'],
    version: 1,
    description: 'Description of your node',
    defaults: {
      name: 'Your Node',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'arkApi',
        required: true,
      },
    ],
    properties: [
      // Define node parameters
    ],
  };

  async execute(this: IExecuteFunctions) {
    // Node execution logic
  }
}
```

### 3. Add Icon

```
nodes/nodes/YourNode/your-node.svg
```

### 4. Export in package.json

```json
{
  "n8n": {
    "nodes": [
      "dist/nodes/YourNode/YourNode.node.js"
    ]
  }
}
```

### 5. Write Tests

```
nodes/nodes/YourNode/__tests__/YourNode.node.test.ts
```

Example:
```typescript
import { YourNode } from '../YourNode.node';
import { createMockExecuteFunctions } from '../../../test-helpers/mocks';

describe('YourNode', () => {
  it('executes successfully', async () => {
    const mockFunctions = createMockExecuteFunctions({
      // mock data
    });

    const node = new YourNode();
    const result = await node.execute.call(mockFunctions);

    expect(result[0][0].json).toHaveProperty('expectedProperty');
  });
});
```

### 6. Build and Test

```bash
cd nodes
npm run build
npm test
npm run lint
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint + Prettier
- **Formatting**: 2 spaces, single quotes
- **Naming**: camelCase for variables, PascalCase for classes

### Follow Existing Patterns

See `ArkAgent.node.ts` as a reference implementation:
- Clear parameter definitions
- Proper error handling
- ARK API helper usage
- Comprehensive JSDoc comments

## Testing Requirements

- **Unit tests**: Test all node logic
- **Coverage**: Minimum 80%
- **Edge cases**: Test error scenarios
- **Mocking**: Use provided test helpers

## Pull Request Process

1. **Fork** the repository
2. **Create branch**: `git checkout -b feature/your-feature`
3. **Write code** following style guidelines
4. **Add tests** with >80% coverage
5. **Run checks**:
   ```bash
   npm run lint
   npm test
   npm run test:coverage
   ```
6. **Commit**: Use conventional commits
   ```
   feat: add YourNode for X functionality
   fix: resolve issue with Y
   docs: update configuration guide
   ```
7. **Push**: `git push origin feature/your-feature`
8. **Open PR** with clear description

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (if applicable)
```

## Reporting Issues

Open issues at: https://github.com/skokaina/ark-n8n-custom-nodes/issues

**Include:**
- n8n version
- ARK version
- Node.js version
- Error messages and logs
- Steps to reproduce
- Expected vs actual behavior

**Issue Template:**

```markdown
### Environment
- ARK n8n version:
- ARK version:
- Node.js version:
- Kubernetes version:

### Description
Clear description of the issue

### Steps to Reproduce
1. Step 1
2. Step 2
3. ...

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Logs
```
Paste relevant logs here
```

### Screenshots
If applicable
```

## Code Review Guidelines

Reviewers check for:
- ✅ Functionality: Code does what it claims
- ✅ Tests: Adequate coverage, edge cases handled
- ✅ Style: Follows project conventions
- ✅ Performance: No obvious bottlenecks
- ✅ Security: No vulnerabilities introduced
- ✅ Documentation: Clear comments and docs

## Release Process

See [Release Guide](./RELEASE.md) for versioning and publishing process.

## Questions?

- Open a [Discussion](https://github.com/skokaina/ark-n8n-custom-nodes/discussions)
- Check [existing issues](https://github.com/skokaina/ark-n8n-custom-nodes/issues)
- Review [ARK documentation](https://mckinsey.github.io/agents-at-scale-ark/)
