import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'uploads/**', '.scratch/**', 'coverage/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      // Underscore-prefixed arguments are the convention for "required by the
      // signature, deliberately unused" — Express error handlers need all four.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // `{}` appears in Mongoose's generic signatures, where it is the intended meaning.
      '@typescript-eslint/no-empty-object-type': 'off',
      // The FCM SDK is loaded with require() on purpose, so it is never pulled in
      // when push notifications are disabled.
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    // Tests assert on shapes the type system cannot always express.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    // The seeder prints demo credentials, and scripts report what they did; that is their job.
    files: ['src/seed/**/*.ts', 'src/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
