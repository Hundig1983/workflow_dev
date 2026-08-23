import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/family/**', '**/dashboard/**', '**/registration/**', '**/shopping/**'],
              message:
                'The auth module must not import family or business logic (ARCHITECTURE.md module boundary).',
            },
          ],
        },
      ],
    },
  },
  {
    // The boundary rule above applies only to the auth module; everything else
    // may depend on auth, just not the reverse.
    files: ['src/**', 'tests/**'],
    ignores: ['src/auth/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
