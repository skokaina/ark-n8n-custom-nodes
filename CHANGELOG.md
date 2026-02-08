# Changelog

All notable changes to the ARK Custom Nodes for n8n project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Configurable authentication schemes**: credentials now support None, Basic (API Key), and Bearer Token auth via a dropdown selector with conditional fields
- **`extractResponseContent()` helper**: handles both current ARK API single `response` string and legacy `responses[]` array formats
- **`getAuthHeader()` helper**: centralized auth header generation replacing duplicated logic across nodes
- **`continueOnFail()` support**: ArkAgent, ArkTeam, ArkAgentAdvanced, and ArkEvaluation gracefully return `{ error }` output instead of crashing the workflow when "Continue On Fail" is enabled in n8n
- **ARK version check init container**: Helm deployment includes an optional init container that queries `ARK_API_URL/v1/version` on startup to verify compatibility
- **`supportedVersions` Helm value**: configurable ARK API version range (`>=0.1.50 <0.1.60`), set to `""` to skip
- **CHANGELOG.md**: project changelog following Keep a Changelog format

### Changed
- **n8n base image**: bumped from `latest` to `2.6.3` (latest stable; 2.7.x is beta)
- **ARK API response handling**: all query nodes now use `extractResponseContent()` for forward-compatible single-response parsing
- **Polling strategy**: replaced fixed 5-second interval with exponential backoff (1s, 2s, 4s, 8s, capped at 10s) across ArkAgent, ArkTeam, ArkAgentAdvanced, ArkEvaluation, and `pollQueryStatus()` helper
- **Sub-node filter restrictions removed**: ArkAgentAdvanced now accepts any n8n `ai_languageModel`, `ai_memory`, and `ai_tool` nodes (not limited to ARK custom sub-nodes)
- **ArkEvaluation auth**: migrated from legacy `token` field to `getAuthHeader()` supporting all three auth schemes
- **ESLint**: upgraded from v8 (`.eslintrc.js`) to v9 flat config (`eslint.config.mjs`)
- **typescript-eslint**: migrated from separate `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` v6 to unified `typescript-eslint` v8 package
- **@types/node**: upgraded from v18 to v22 to match CI Node.js version
- **eslint-config-prettier**: upgraded to v10; removed `eslint-plugin-prettier` (redundant)
- **ts-jest**: moved `isolatedModules: true` from jest config to `tsconfig.json` to fix deprecation warning

### Fixed
- Unused catch clause variables (`error` -> `_error`) flagged by stricter ESLint rules in ArkEvaluation, ArkMemory, ArkModelSelector, and ArkTool
