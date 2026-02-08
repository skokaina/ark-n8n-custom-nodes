# Security & Quality Tools Setup Guide

This guide walks you through setting up Codecov, SonarCloud, and Aikido Security for your repository.

## Overview

| Tool | Purpose | Manual Setup Required | Public Repo Free |
|------|---------|----------------------|------------------|
| **Codecov** | Code coverage reporting | Optional (token recommended) | ✅ Yes |
| **SonarCloud** | Code quality & security analysis | ✅ Required | ✅ Yes |
| **Aikido Security** | Application security scanning | ✅ Required | ✅ Yes (limited) |
| **OSSF Scorecard** | Security best practices | ❌ None | ✅ Yes |

---

## 1. Codecov Setup

### Step 1: Sign Up
1. Go to https://codecov.io
2. Click **"Sign up with GitHub"**
3. Authorize Codecov to access your repositories

### Step 2: Add Repository
1. In Codecov dashboard, click **"Add new repository"**
2. Find and select `skokaina/ark-n8n-custom-nodes`
3. Codecov will provide you with a token

### Step 3: Add GitHub Secret
1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **"New repository secret"**
4. Name: `CODECOV_TOKEN`
5. Value: Paste the token from Codecov
6. Click **"Add secret"**

### Step 4: Verify
- Push to `main` or create a PR
- Check the **Actions** tab for the test workflow
- Coverage report will appear at: https://codecov.io/gh/skokaina/ark-n8n-custom-nodes

### Configuration
The workflow is configured to:
- Upload `lcov.info` coverage reports
- Mark as `unittests` flag
- Not fail CI if upload errors occur (`fail_ci_if_error: false`)

---

## 2. SonarCloud Setup

### Step 1: Sign Up
1. Go to https://sonarcloud.io
2. Click **"Log in"** → **"Sign up with GitHub"**
3. Authorize SonarCloud

### Step 2: Create Organization
1. Click **"+"** → **"Analyze new project"**
2. Choose **"Import an organization from GitHub"**
3. Select your GitHub account (`skokaina`)
4. Click **"Install"** and authorize

### Step 3: Import Project
1. After organization setup, click **"+"** → **"Analyze new project"**
2. Select `ark-n8n-custom-nodes`
3. Click **"Set up"**

### Step 4: Configure Project
1. Choose **"With GitHub Actions"** (recommended)
2. SonarCloud will display your `SONAR_TOKEN`
3. Copy the token

### Step 5: Add GitHub Secret
1. Go to GitHub repository → **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Name: `SONAR_TOKEN`
4. Value: Paste the token from SonarCloud
5. Click **"Add secret"**

### Step 6: Verify Configuration
Verify your SonarCloud organization and project key match the workflow:
- Organization: `skokaina` (configured in `sonarcloud.yml`)
- Project Key: `skokaina_ark-n8n-custom-nodes` (configured in `sonar-project.properties`)

If different, update:
- `.github/workflows/sonarcloud.yml` (lines with `-Dsonar.organization` and `-Dsonar.projectKey`)
- `sonar-project.properties` (first 2 lines)

### Step 7: Verify
- Push to `main` or create a PR
- SonarCloud will analyze your code
- View results at: https://sonarcloud.io/project/overview?id=skokaina_ark-n8n-custom-nodes

### Configuration Files
- **Workflow**: `.github/workflows/sonarcloud.yml`
- **Config**: `sonar-project.properties` (project-level settings)

---

## 3. Aikido Security Setup

### Step 1: Sign Up
1. Go to https://www.aikido.dev
2. Click **"Start for free"**
3. Sign up with GitHub

### Step 2: Add Repository
1. In Aikido dashboard, click **"Add Repository"**
2. Select `skokaina/ark-n8n-custom-nodes`
3. Enable **"GitHub Actions Integration"**

### Step 3: Get Secret Key
1. In Aikido, go to **Settings → Integrations → GitHub Actions**
2. Copy your **Secret Key**

### Step 4: Add GitHub Secret
1. Go to GitHub repository → **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Name: `AIKIDO_SECRET_KEY`
4. Value: Paste the secret key from Aikido
5. Click **"Add secret"**

### Step 5: Verify
- Push to `main` or trigger workflow manually
- Aikido will scan for:
  - Dependency vulnerabilities (npm packages)
  - Security misconfigurations
  - Secrets in code
  - Container vulnerabilities (Dockerfile)
- View results in Aikido dashboard

### Configuration
- **Workflow**: `.github/workflows/aikido-security.yml`
- **Scan Frequency**: Daily at 3 AM UTC + on push/PR
- **What it scans**: Dependencies, code, containers, IaC

---

## 4. OSSF Scorecard (Already Configured)

✅ **No manual setup required!**

- Runs weekly on Mondays
- Results visible in Security tab
- Badge updates automatically
- View detailed report: https://scorecard.dev/viewer/?uri=github.com/skokaina/ark-n8n-custom-nodes

---

## Quick Setup Checklist

### Required GitHub Secrets

Add these in **Settings → Secrets and variables → Actions**:

- [ ] `CODECOV_TOKEN` - From codecov.io
- [ ] `SONAR_TOKEN` - From sonarcloud.io
- [ ] `AIKIDO_SECRET_KEY` - From aikido.dev

### Verification Steps

After adding all secrets:

1. **Create a test PR** or **push to main**
2. **Check Actions tab** - All 4 workflows should run:
   - ✅ Test (with Codecov upload)
   - ✅ SonarCloud Analysis
   - ✅ Aikido Security
   - ✅ OSSF Scorecard (runs weekly, or manually trigger)
3. **Check badges in README** - Should display status after first run

---

## Troubleshooting

### Codecov Upload Fails
- Verify `CODECOV_TOKEN` is correct
- Check that `nodes/coverage/lcov.info` is generated
- Review workflow logs in Actions tab

### SonarCloud Fails
- Verify `SONAR_TOKEN` is correct
- Check organization and project key match in:
  - `.github/workflows/sonarcloud.yml`
  - `sonar-project.properties`
- Ensure coverage reports are generated before SonarCloud step

### Aikido Security Fails
- Verify `AIKIDO_SECRET_KEY` is correct
- Check Aikido dashboard for repository connection status
- Ensure repository is authorized in Aikido settings

### Badges Not Showing
- Wait for first workflow run to complete
- Clear browser cache
- Check badge URLs match your repository name

---

## Cost Information

### Free Tier Limits

| Tool | Free for Public Repos | Free for Private Repos |
|------|----------------------|------------------------|
| **Codecov** | Unlimited | Limited users |
| **SonarCloud** | Unlimited | ❌ Paid only |
| **Aikido** | Yes (limited scans) | Trial available |
| **OSSF Scorecard** | Unlimited | Unlimited |

### Recommendations for Public Repos
All tools are **100% free** for public repositories with generous limits. No credit card required.

---

## Additional Resources

- **Codecov Docs**: https://docs.codecov.com/docs
- **SonarCloud Docs**: https://docs.sonarcloud.io
- **Aikido Docs**: https://docs.aikido.dev
- **OSSF Scorecard**: https://github.com/ossf/scorecard

---

## Next Steps

After setup, consider:
1. **Enable Dependabot** - GitHub Settings → Security → Dependabot
2. **Enable Branch Protection** - Require PR reviews, status checks
3. **Configure Code Scanning** - GitHub Advanced Security features
4. **Review Security Policies** - Add SECURITY.md with vulnerability reporting process
