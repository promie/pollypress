module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/app'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
