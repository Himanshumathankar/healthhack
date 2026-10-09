const base = require("@healthhack/eslint-config");

module.exports = [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/coverage/**"]
  },
  ...base,
  {
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off"
    }
  }
];
