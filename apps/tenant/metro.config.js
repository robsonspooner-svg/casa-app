const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages — app-local first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Explicitly map workspace packages
config.resolver.extraNodeModules = {
  '@casa/config': path.resolve(monorepoRoot, 'packages/config'),
  '@casa/ui': path.resolve(monorepoRoot, 'packages/ui'),
  '@casa/api': path.resolve(monorepoRoot, 'packages/api'),
};

// Reset transformer to handle React Native's internal files
config.resetCache = true;

module.exports = config;
