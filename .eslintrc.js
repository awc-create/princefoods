// eslint.config.mjs
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // Base JS rules
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.browser,
    },
  },

  // TypeScript
  ...tseslint.configs.recommended,

  // React
  {
    files: ['**/*.{jsx,tsx}'],
    ...pluginReact.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
    rules: {
      // Auto runtime -> no need to import React
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },

  // Next.js (core web vitals)
  nextPlugin.configs['core-web-vitals'],

  // Project rules you might want (optional softenings)
  {
    rules: {
      // Turn these to 'warn' or 'off' if you prefer:
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': 'warn',
      // If you saw this warning:
      // 'react-hooks/exhaustive-deps' not found -> provided by eslint-plugin-react-hooks,
      // which Next includes via its config; the Next flat config above covers it.
    },
  },
]);
