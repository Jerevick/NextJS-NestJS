import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@unicore/ui', '@unicore/types', '@unicore/utils'],
};

export default async function createConfig(): Promise<NextConfig> {
  if (process.env.ANALYZE === 'true') {
    const bundleAnalyzer = (await import('@next/bundle-analyzer')).default;
    return bundleAnalyzer({ enabled: true })(nextConfig);
  }
  return nextConfig;
}
