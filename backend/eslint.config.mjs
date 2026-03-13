// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs']
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            },
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                ecmaVersion: 'latest'
            }
        },
        rules: {
            /*
             * Keep this conventional and productivity-friendly:
             * focus on correctness/safety, not heavy formatting micromanagement.
             */

            /* Your preferences */
            indent: ['off'],
            'eol-last': ['error', 'always'],

            /* Basic style (lightweight, low-friction) */
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'no-trailing-spaces': 'error',
            'no-multiple-empty-lines': ['error', { max: 1 }],
            'comma-dangle': ['error', 'never'],

            /* Nest-friendly */
            'no-console': 'off', // You can switch to 'error' later when using Nest Logger consistently

            /* TypeScript practical adjustments */
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn'
        }
    }
);
