module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'credentials/**/*.ts',
    'nodes/**/*.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageThreshold: {
    './credentials/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './nodes/ArkAgent/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './nodes/ArkModel/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './nodes/ArkTeam/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  }
};
