export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  // Include every test file. Which subset actually runs is decided by the
  // npm scripts via --testPathIgnorePatterns / --testPathPatterns.
  // (The previous config put '!**/__tests__/integration/**' in testMatch, so
  // `npm run test:integration` -- which filters ON integration -- matched
  // nothing and always failed with "no tests found".)
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/middleware/**/*.js',
    'src/services/**/*.js',
    'src/routes/**/*.js',
    '!src/**/__tests__/**',
  ],
}
