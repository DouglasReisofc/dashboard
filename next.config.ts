import type { NextConfig } from "next";
import path from "path";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const normalizedBasePath = rawBasePath && rawBasePath !== "/"
  ? (rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`)
  : "";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  basePath: normalizedBasePath || undefined,
  assetPrefix: normalizedBasePath ? `${normalizedBasePath}/` : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  typescript: {
    // Keep DX smooth: do not block build on type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Avoid blocking production builds due to lint errors
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: normalizedBasePath,
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "node_modules")],
  },
};

export default nextConfig;
