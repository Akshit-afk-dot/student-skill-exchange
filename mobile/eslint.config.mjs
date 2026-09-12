import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      '.probe-export/**',
      '.ci-export/**',
      'babel.config.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        globalThis: 'readonly',
        __DEV__: 'readonly',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Unused imports are the main thing this config exists to catch — they accumulate
      // fast when screens are refactored, and nothing else in the toolchain flags them.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // The dependency arrays on useAsync/useCountUp are deliberately curated; the rule
      // cannot see through the custom hooks, so it warns rather than blocks.
      'react-hooks/exhaustive-deps': 'warn',

      /*
       * The rules below ship with eslint-plugin-react-hooks v6 and exist to prepare a
       * codebase for the React Compiler. They are switched off deliberately, not to
       * silence real bugs:
       *
       * - `immutability` flags `sharedValue.value = withSpring(...)`, which is
       *   Reanimated's documented and only API for driving an animation.
       * - `refs` flags the `useRef(fn).current` pattern, which FlatList's
       *   `onViewableItemsChanged` actually requires — it throws if the identity changes.
       * - `set-state-in-effect` flags effect-driven fetching, which is what every data
       *   hook here does on purpose.
       * - `purity` flags `Date.now()` in render; for "has this session started yet" a
       *   fresh read per render is the intent, not a defect.
       *
       * Revisit all four if this project ever adopts the React Compiler, since then they
       * stop being stylistic and start describing real constraints.
       */
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
);
