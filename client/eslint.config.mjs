import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'assets/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/family/**', '**/screens/**'],
              message:
                'The auth module must not import family or screen logic (ARCHITECTURE.md module boundary; mirrors backend/eslint.config.js).',
            },
          ],
        },
      ],
    },
  },
  {
    // The boundary rule above applies only to the auth module; everything else
    // may depend on auth, just not the reverse.
    files: ['App.tsx', 'index.ts', 'src/**'],
    ignores: ['src/auth/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
