/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/typescript',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'eqeqeq': ['error', 'always'],
  },
  overrides: [
    {
      // Presentation layer may import Phaser
      files: ['src/presentation/**/*.ts', 'src/main.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    {
      // Tests may be more relaxed
      files: ['tests/**/*.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts', 'vitest.config.ts'],
};
