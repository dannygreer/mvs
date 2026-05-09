import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/mvs/admin",
        permanent: true,
      },
      {
        source: "/admin/:path*",
        destination: "/mvs/admin/:path*",
        permanent: true,
      },
      {
        source: "/active-threat/admin",
        destination: "/mvs/admin",
        permanent: true,
      },
      {
        source: "/active-threat/admin/:path*",
        destination: "/mvs/admin/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
