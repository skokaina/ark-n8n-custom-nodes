# Development Guide

## Local Development with DevSpace

### Setup with ngrok (for webhooks)

**1. Configure environment:**

```bash
cp .env.example .env
```

Edit `.env`:
```bash
NGROK_DOMAIN=your-subdomain.ngrok-free.app
NGROK_PORT=8080
NGROK_N8N_HOST_HEADER=ark-n8n-devspace.default.127.0.0.1.nip.io
```

**2. Start environment:**

```bash
./devspace-start.sh
```

**3. Deploy with DevSpace:**

```bash
devspace dev
```

**4. Stop environment:**

```bash
./devspace-stop.sh
```

### Manual DevSpace (without ngrok)

```bash
devspace dev
```

Changes to TypeScript files in `nodes/` trigger automatic rebuild and container restart.

## Building Custom Nodes

```bash
cd nodes
npm install
npm run build
```

Output: `nodes/dist/` contains compiled JavaScript and type definitions.

## Running Tests

### Unit Tests

```bash
cd nodes
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report (target: >80%)
```

### E2E Tests

See [Testing Guide](./TESTING.md) for detailed E2E testing documentation.

```bash
make e2e-setup    # Setup k3d cluster with ARK
make e2e          # Run Playwright tests
make e2e-cleanup  # Cleanup
```

## Linting

```bash
cd nodes
npm run lint        # Check for issues
npm run lintfix     # Auto-fix issues
```

## Docker

### Build Image

```bash
make docker-build
```

### Run Locally

```bash
make docker-run
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make build` | Build custom nodes |
| `make test` | Run unit tests |
| `make lint` | Lint code |
| `make dev` | Start DevSpace |
| `make e2e-setup` | Setup E2E environment |
| `make e2e` | Run E2E tests |
| `make clean` | Clean build artifacts |

See [Contributing Guide](./CONTRIBUTING.md) for code style and PR guidelines.
