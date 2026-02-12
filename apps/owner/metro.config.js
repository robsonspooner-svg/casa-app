const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root (monorepo root)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Explicitly map workspace packages
config.resolver.extraNodeModules = {
  '@casa/config': path.resolve(monorepoRoot, 'packages/config'),
  '@casa/ui': path.resolve(monorepoRoot, 'packages/ui'),
  '@casa/api': path.resolve(monorepoRoot, 'packages/api'),
};

// 4. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

// 5. Reset transformer to handle React Native's internal files with 'as const'
config.resetCache = true;

// 6. Production bundle optimization: strip console.* calls from minified output
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: true,
    },
  },
};

module.exports = config;
