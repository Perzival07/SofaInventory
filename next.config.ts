import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones/tablets on the shop's LAN load dev-server assets, which Next
  // otherwise rejects with 403 for any non-localhost origin.
  allowedDevOrigins: ["192.168.29.229", "192.168.29.*", "192.168.1.*", "192.168.0.*"],
};

export default nextConfig;
