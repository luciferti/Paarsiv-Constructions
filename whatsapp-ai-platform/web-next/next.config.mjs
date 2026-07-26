/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxy API + uploads + websocket polling to the Express backend on :4000.
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:4000/uploads/:path*" },
      { source: "/socket.io/:path*", destination: "http://localhost:4000/socket.io/:path*" },
    ];
  },
};

export default nextConfig;
