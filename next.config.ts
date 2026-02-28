import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["react-markdown", "remark-gfm"],
};

export default nextConfig;
