import js from "@eslint/js";

// Minimal flat config so the repo's existing husky/lint-staged `eslint --fix`
// pre-commit hook (package.json) can actually run -- no eslint.config.js has
// ever existed in this repo's history under ESLint 9's flat-config
// requirement, which made every commit fail the hook unconditionally.
// Intentionally minimal (core recommended rules only, JSX parsing enabled so
// .jsx files don't hard-fail); not a statement on what the repo's full lint
// ruleset should eventually be.
export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __VU: "readonly",
        __ITER: "readonly",
        __ENV: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "target/**",
      "circuits/target/**",
      "**/target/**",
    ],
  },
];
