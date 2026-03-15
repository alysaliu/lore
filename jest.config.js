/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.jsx'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!firebase)/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

module.exports = config;
