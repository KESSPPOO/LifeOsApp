// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Quotes and apostrophes inside <Text> are rendered literally in React
      // Native; escaping them is an HTML concern. Keep flagging `>` and `}`,
      // which usually mean a JSX typo.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
]);
