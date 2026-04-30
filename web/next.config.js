/** @type {import('next').NextConfig} */

// Resolve the build-time application version. Priority:
//   1. Explicit APP_VERSION env (set by CI from the release tag)
//   2. `git describe --tags` when building from a checkout (local dev)
//   3. Empty string → frontend treats it as "unknown" and shows the
//      latest GitHub release as a neutral fallback.
const APP_VERSION = (() => {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const { execSync } = require("child_process");
    return execSync("git describe --tags --always --dirty=-dev", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
})();

const nextConfig = {
  allowedDevOrigins: [
    "agreed-pool-resources-laser.trycloudflare.com",
    "bingo-desire-applicant-response.trycloudflare.com",
    "erp-hawk-climate-life.trycloudflare.com",
  ],

  // Expose the build-time version to the browser so the sidebar badge
  // can compare it against GitHub's latest release.
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },

  experimental: {
    // Reduce peak Webpack memory usage in local development at the cost
    // of slightly slower recompiles.
    webpackMemoryOptimizations: true,
    // Avoid preloading every route module into memory when the dev server boots.
    preloadEntriesOnStart: false,
  },

  // Standalone output: self-contained server.js + minimal node_modules
  // This eliminates the need to copy the full node_modules into Docker production images
  output: "standalone",

  // Move dev indicator to bottom-right corner
  devIndicators: {
    position: "bottom-right",
  },

  // Transpile mermaid and related packages for proper ESM handling
  transpilePackages: ["mermaid"],

  async rewrites() {
    const backend =
      process.env.NEXT_PROXY_BACKEND ||
      process.env.NEXT_PUBLIC_API_BASE_EXTERNAL ||
      "http://localhost:8001";
    return [
      {
        source: "/api/:path*",
        destination: `${backend.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },

  // Turbopack configuration (used when running `npm run dev:turbo`)
  turbopack: {
    root: __dirname,
    resolveAlias: {
      // Fix for mermaid's cytoscape dependency - use CJS version
      cytoscape: "cytoscape/dist/cytoscape.cjs.js",
    },
  },

  // Webpack configuration (used for production builds - next build)
  webpack: (config) => {
    const path = require("path");
    config.resolve.alias = {
      ...config.resolve.alias,
      cytoscape: path.resolve(
        __dirname,
        "node_modules/cytoscape/dist/cytoscape.cjs.js",
      ),
    };
    return config;
  },
};

module.exports = nextConfig;
