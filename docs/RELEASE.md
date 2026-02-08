# Release Process

## Overview

This project uses automated releases via GitHub Actions. The release workflow handles version bumping, tagging, building, and publishing.

## Quick Release

### Via Make (Recommended)

Requires [GitHub CLI](https://cli.github.com/):

```bash
make release-patch  # Bug fixes (0.0.5 -> 0.0.6)
make release-minor  # New features (0.0.5 -> 0.1.0)
make release-major  # Breaking changes (0.0.5 -> 1.0.0)
```

### Via GitHub UI

1. Go to [Actions](../../actions/workflows/release.yml)
2. Click "Run workflow"
3. Select version bump type (patch/minor/major)
4. Click "Run workflow"

## What Happens During Release

1. **Version Bump**
   - Updates `nodes/package.json`
   - Updates `nodes/package-lock.json`
   - Updates `chart/Chart.yaml` (version and appVersion)

2. **Git Operations**
   - Commits version changes to main branch
   - Creates git tag (e.g., `v0.0.6`)
   - Pushes tag to remote

3. **Automated Builds** (triggered by tag)
   - **build.yml**: Builds custom nodes and Docker image
     - Multi-arch: linux/amd64, linux/arm64
     - Pushed to `ghcr.io/skokaina/ark-n8n:VERSION` and `:latest`
   - **helm.yml**: Packages and publishes Helm chart
     - Pushed to `oci://ghcr.io/skokaina/charts/ark-n8n`

4. **GitHub Release**
   - Creates release page with changelog
   - Includes installation instructions

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes (e.g., 1.0.0 -> 2.0.0)
- **MINOR**: New features, backward compatible (e.g., 0.1.0 -> 0.2.0)
- **PATCH**: Bug fixes, backward compatible (e.g., 0.0.5 -> 0.0.6)

### Examples

| Current | Bump Type | New Version | Use Case |
|---------|-----------|-------------|----------|
| 0.0.5 | patch | 0.0.6 | Fix ARK Agent timeout bug |
| 0.0.5 | minor | 0.1.0 | Add new ARK Workflow node |
| 0.0.5 | major | 1.0.0 | Stable API, production ready |

## Release Checklist

Before releasing:

- [ ] All tests pass (`make test`)
- [ ] E2E tests pass (`make e2e`)
- [ ] Linting passes (`make lint`)
- [ ] CHANGELOG.md updated (if exists)
- [ ] Documentation updated
- [ ] No known critical bugs

## Manual Release (Advanced)

If you need to release manually:

```bash
# 1. Bump version
cd nodes
npm version patch  # or minor, major

# 2. Update Chart.yaml
NEW_VERSION=$(node -p "require('./package.json').version")
cd ../chart
sed -i "s/^version:.*/version: $NEW_VERSION/" Chart.yaml
sed -i "s/^appVersion:.*/appVersion: $NEW_VERSION/" Chart.yaml

# 3. Commit and tag
git add nodes/package.json nodes/package-lock.json chart/Chart.yaml
git commit -m "chore: bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"
```

## Troubleshooting

### Release workflow fails

**Check workflow logs:**
1. Go to [Actions](../../actions)
2. Click on failed workflow
3. Review error messages

**Common issues:**
- Version already exists: Tag might already be pushed
- Permission denied: Check GITHUB_TOKEN permissions
- Build fails: Run `make build` locally to debug

### Docker image not published

Check [build.yml workflow](../../actions/workflows/build.yml):
- Ensure tag was pushed correctly
- Verify GITHUB_TOKEN has package write permissions

### Helm chart not published

Check [helm.yml workflow](../../actions/workflows/helm.yml):
- Ensure Chart.yaml version matches tag
- Verify OCI registry permissions

## Post-Release

After a successful release:

1. **Verify Docker image:**
   ```bash
   docker pull ghcr.io/skokaina/ark-n8n:VERSION
   docker run ghcr.io/skokaina/ark-n8n:VERSION --version
   ```

2. **Verify Helm chart:**
   ```bash
   helm show chart oci://ghcr.io/skokaina/charts/ark-n8n --version VERSION
   ```

3. **Test installation:**
   ```bash
   helm install ark-n8n-test oci://ghcr.io/skokaina/charts/ark-n8n --version VERSION
   kubectl get pods
   ```

4. **Announce release:**
   - Update main README.md if needed
   - Notify users via appropriate channels

## Rollback

If a release has issues:

### Rollback Docker image

```bash
# Tag previous version as latest
docker pull ghcr.io/skokaina/ark-n8n:PREVIOUS_VERSION
docker tag ghcr.io/skokaina/ark-n8n:PREVIOUS_VERSION ghcr.io/skokaina/ark-n8n:latest
docker push ghcr.io/skokaina/ark-n8n:latest
```

### Rollback Helm chart

Users can install specific version:

```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n --version PREVIOUS_VERSION
```

### Delete bad release

```bash
# Delete tag
git tag -d vBAD_VERSION
git push origin :refs/tags/vBAD_VERSION

# Delete GitHub release (via UI or gh CLI)
gh release delete vBAD_VERSION
```

## CI/CD Workflows

### release.yml

**Trigger:** Manual workflow_dispatch
**Purpose:** Version bumping and tagging
**Permissions:** contents:write, packages:write

### build.yml

**Trigger:** Tags matching `v*`
**Purpose:** Build and publish Docker images
**Outputs:** ghcr.io/skokaina/ark-n8n:VERSION and :latest

### helm.yml

**Trigger:** Tags matching `v*`
**Purpose:** Package and publish Helm chart
**Outputs:** oci://ghcr.io/skokaina/charts/ark-n8n

### e2e.yml

**Trigger:** PRs, pushes to main, nightly schedule
**Purpose:** End-to-end testing
**Outputs:** Test reports and artifacts

## Best Practices

1. **Release often**: Small, frequent releases are easier to manage
2. **Test thoroughly**: Always run full test suite before releasing
3. **Semantic versioning**: Follow SemVer strictly for user clarity
4. **Document changes**: Keep CHANGELOG.md updated
5. **Monitor releases**: Check that Docker/Helm artifacts publish successfully
6. **Communication**: Announce breaking changes prominently

## Support

For issues with releases:
- Check [GitHub Actions](../../actions)
- Review [troubleshooting guide](./TROUBLESHOOTING.md)
- Open an issue with release logs
