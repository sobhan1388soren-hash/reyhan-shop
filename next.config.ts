const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  images: {
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