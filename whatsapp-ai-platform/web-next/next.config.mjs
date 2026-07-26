const API_URL = process.env.API_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxy API + uploads to the Express backend (API_URL in containers).
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
      { source: "/socket.io/:path*", destination: `${API_URL}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
