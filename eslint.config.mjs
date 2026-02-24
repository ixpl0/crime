import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));
const typedFiles = ["src/**/*.{ts,vue}", "vite.config.ts"];

const strictTypeCheckedForTypedFiles = tseslint.configs.strictTypeChecked.map((config) => ({
  ...config,
  files: typedFiles
}));

const disableTypeCheckedForJsFiles = {
  ...tseslint.configs.disableTypeChecked,
  files: ["**/*.{js,cjs,mjs}"]
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", ".claude/**"]
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.node
      }
    }
  },
  ...strictTypeCheckedForTypedFiles,
  ...vue.configs["flat/essential"],
  {
    files: ["src/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir,
        extraFileExtensions: [".vue"]
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "vue/multi-word-component-names": "off"
    }
  },
  {
    files: ["src/**/*.ts", "vite.config.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ["src/**/*.{ts,vue}", "vite.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports"
        }
      ]
    }
  },
  {
    files: ["electron/preload.cjs"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='require'] > Literal.arguments:first-child[value=/^\\.\\.?\\//]",
          message:
            "Do not use local require('./...') in sandboxed preload. Keep electron/preload.cjs self-contained."
        }
      ]
    }
  },
  disableTypeCheckedForJsFiles
];
