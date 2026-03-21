import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["react-markdown", "remark-gfm"],
  // Expose MULTI_TENANT_ENABLED to the Edge Runtime (middleware).
  // Without this, process.env.MULTI_TENANT_ENABLED is undefined in the Edge
  // Runtime and isMultiTenantEnabled() always returns false, causing middleware
  // to always resolve the WCC tenant regardless of the session cookie.
  env: {
    MULTI_TENANT_ENABLED: process.env.MULTI_TENANT_ENABLED ?? "false",
  },
};

export default nextConfig;
