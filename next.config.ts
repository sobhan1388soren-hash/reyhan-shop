const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  images: {
    qualities: [75, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.supabase.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "localhost",
        port: "54321",
      },
    ],
  },
};

export default nextConfig;