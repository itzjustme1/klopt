import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

const noHtmlSinks = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-restricted-properties": [
    "error",
    { property: "innerHTML", message: "Never render text as HTML." },
    { property: "outerHTML", message: "Never render text as HTML." },
    { property: "insertAdjacentHTML", message: "Never render text as HTML." },
    { object: "document", property: "write", message: "Never render text as HTML." },
  ],
};

export default ts.config(
  { ignores: ["dist", "dev-dist", "node_modules", "test-results", "playwright-report", "public/ocr"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, __APP_VERSION__: "readonly" } },
    rules: {
      ...noHtmlSinks,
      "svelte/no-at-html-tags": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: [".svelte"] } },
  },
);
