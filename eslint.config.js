import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'dist-lh', 'dev-dist', 'test-results', 'playwright-report', '.lighthouseci', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Only the classic two rules for now; the React Compiler rules in the
      // plugin's v7 preset are tracked separately in #72.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Focus only ever moves into an input the user just asked to open
      // (new project, rename, text edit), which is what they expect.
      'jsx-a11y/no-autofocus': 'off',
      // Slider's label text sits three levels deep (label > span > span).
      'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**', '*.config.{js,ts}', 'e2e/playwright.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  prettier,
)
