import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@unicore/ui', '@unicore/types', '@unicore/utils'],
};

export default nextConfig;
