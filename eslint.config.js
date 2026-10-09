const base = require("@healthhack/eslint-config");

module.exports = [
  ...base,
  {
    ignores: ["node_modules/**", "dist/**", ".next/**", "coverage/**"]
  },
  {
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off"
    }
  }
];
