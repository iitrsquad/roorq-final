/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Removed 'localhost' for production - add back if needed for local development
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.unsplash.com',
      },
    ],
    unoptimized: false,
  },
  // Suppress build warnings for production
  eslint: {
    ignoreDuringBuilds: false, // Keep ESLint but allow warnings
  },
  typescript: {
    ignoreBuildErrors: false, // Keep type checking
  },
};

module.exports = nextConfig;
