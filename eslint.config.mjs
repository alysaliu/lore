import nextConfig from 'eslint-config-next/core-web-vitals';

export default [
  ...nextConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/public/**',
      '*.config.js',
      'jest.config.js',
      'babel.config.js',
      '**/__tests__/**',
    ],
  },
];
