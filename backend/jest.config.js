module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
  coverageReporters: ['text', 'lcov'],
  testTimeout: 30000, // 30 seconds timeout for tests
};
