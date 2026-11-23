import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

// msedge-tts opens a WebSocket with `ws`; load both from node_modules at runtime instead of bundling them.
const nextConfig: NextConfig = { serverExternalPackages: ["msedge-tts", "ws"] };

export default withWorkflow(nextConfig);
