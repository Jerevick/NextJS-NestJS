import base from '@unicore/eslint-config';

export default [
  ...base,
  {
    ignores: ['prisma/migrations/**'],
  },
];
