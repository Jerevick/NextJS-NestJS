import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@unicore/ui', '@unicore/types', '@unicore/utils'],
};

export default nextConfig;
