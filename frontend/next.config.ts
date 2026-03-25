// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from your own FastAPI backend + common CDN hosts
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost",       port: "8000" },
      { protocol: "https", hostname: "*.supabase.co"               },
      { protocol: "https", hostname: "res.cloudinary.com"          },
    ],
  },

  // Expose public env vars; NEVER put secrets here
  env: {
    NEXT_PUBLIC_API_URL:       process.env.NEXT_PUBLIC_API_URL       ?? "http://localhost:8000",
    NEXT_PUBLIC_WS_URL:        process.env.NEXT_PUBLIC_WS_URL        ?? "ws://localhost:8000",
    NEXT_PUBLIC_RESTAURANT_ID: process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  },

  // Silence noisy peer-dep warnings from recharts/date-fns during build
  experimental: {
    // optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
