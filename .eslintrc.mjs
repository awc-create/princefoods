// eslint.config.mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

// Plugins & parsers must be explicitly added for flat config:
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // 0) Global ignores
  {
    ignores: ['**/node_modules/**', '.next/**', 'out/**', 'dist/**', 'coverage/**'],
  },

  // 1) Provide plugins (flat config requirement)
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
  },

  // 2) Language options (JSX + TS parser)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
      parser: tsParser,
    },
    settings: {
      react: { version: 'detect' }, // silence “React version not specified”
    },
  },

  // 3) Next.js base configs (ported via compat)
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // 4) Your project rules (explicitly disable JSX-scope rule here)
  {
    rules: {
      // Turn off the old transform rule
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // TS-aware unused vars (allow _prefix to ignore)
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 3,
        },
      ],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Optional: temporarily allow <img> until migrated to next/image
  // {
  //   files: ['**/*.{tsx,jsx}'],
  //   rules: { '@next/next/no-img-element': 'off' },
  // },
];
