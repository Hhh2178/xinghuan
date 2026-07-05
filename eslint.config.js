import js from "@eslint/js";
import globals from "globals";
import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/dist-release/**",
      "**/.codegraph/**",
      "**/node_modules/**",
      "**/runtime/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-undef": "off",
      "no-control-regex": "warn",
      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",
      "no-irregular-whitespace": "warn",
      "no-unreachable": "warn",
      "no-useless-escape": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      "no-undef": "off",
      "no-control-regex": "warn",
      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",
      "no-irregular-whitespace": "warn",
      "no-unreachable": "warn",
      "no-useless-escape": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "warn",
      "no-control-regex": "warn",
      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",
      "no-irregular-whitespace": "warn",
      "no-unreachable": "warn",
      "no-useless-escape": "warn",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  prettierConfig,
];
