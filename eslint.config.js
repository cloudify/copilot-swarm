import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        URLSearchParams: "readonly",
        // Browser globals
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Prevent rendering of empty strings/values without Text wrapper
      "react/jsx-no-useless-fragment": "warn",
      "react/jsx-no-comment-textnodes": "error",

      // General React rules
      "react/prop-types": "off", // Using TypeScript
      "react/display-name": "off",
      "react/no-unescaped-entities": "warn",

      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off", // Too restrictive for existing code
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn", // Make this a warning instead of error
        { prefer: "type-imports" }
      ],

      // General JavaScript rules
      "no-unused-vars": "off", // Using TypeScript version
      "no-console": "off", // We need console for debugging
      "prefer-const": "error",
      "eqeqeq": ["warn", "always"], // Make warning instead of error
      "curly": ["warn", "all"], // Make warning instead of error
      "no-var": "error",

      // Custom rule to catch potential empty string issues
      "no-template-curly-in-string": "warn",

      // Additional rules to prevent empty string rendering issues
      "no-implicit-coercion": [
        "warn",
        { boolean: false, number: false, string: true },
      ],

      // Enhanced rules for Ink/React safety
      "no-empty-pattern": "error",
      "no-lonely-if": "warn",
    },
  },
  // Test files configuration
  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        URLSearchParams: "readonly",
        // Jest/testing globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        beforeAll: "readonly",
        afterEach: "readonly",
        afterAll: "readonly",
        jest: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off",
    },
  },
];
