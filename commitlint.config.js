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
        'view',
        'grouping',
        // Reporters
        'reporters',
        'stdout-reporter',
        'json-reporter',
        'markdown-reporter',
        'html-reporter',
        // Packages
        'action',
        // Meta
        'readme',
        'deps',
        'ci',
        'release',
      ],
    ],
  },
};
