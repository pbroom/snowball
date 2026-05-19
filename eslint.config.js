import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/dist-types/**", "**/node_modules/**", ".cursor/**", "vitest.config.ts", "**/*.d.ts"]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "no-undef": "off"
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ["apps/rebac-workbench/scripts/perf-clicks.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  }
);
