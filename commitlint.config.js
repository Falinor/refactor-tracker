export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Source modules
        'cli',
        'config',
        'engine',
        'detect',
        'runner',
        'cache',
        'state',
        'grouping',
        // Reporters
        'reporters',
        'stdout-reporter',
        'json-reporter',
        'markdown-reporter',
        'html-reporter',
        // Meta
        'readme',
        'deps',
        'ci',
        'release',
      ],
    ],
  },
};
