export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  testMatch: ['**/__tests__/**/*.test.js', '!**/__tests__/integration/**'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/middleware/**/*.js',
    'src/services/**/*.js',
    '!src/**/__tests__/**',
  ],
}
