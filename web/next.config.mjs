/** @type {import('next').NextConfig} */
const ENGINE_URL = process.env.ENGINE_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  // The browser talks only to this origin; /api/* is forwarded to the Python engine.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${ENGINE_URL}/api/:path*` }];
  },
  // The plan request runs the full replay (a few seconds); give the proxy room.
  experimental: { proxyTimeout: 180000 },
};

export default nextConfig;
