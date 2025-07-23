import { copy } from "@guanghechen/rollup-plugin-copy"
import commonjs from "@rollup/plugin-commonjs"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import rollupTypescript from "@rollup/plugin-typescript"
import fs from "fs"
import serve from "rollup-plugin-serve"

const isProduction = process.env.NODE_ENV === "production"
const isWatching = process.env.ROLLUP_WATCH === "true"

// Check if SSL certificates exist
const sslCertPath = "./cert/localhost+1-key.pem"
const sslCertExists =
  fs.existsSync(sslCertPath) && fs.existsSync("./cert/localhost+1.pem")

const plugins = [
  rollupTypescript({
    jsx: "react",
    outputToFilesystem: true,
  }),
  nodeResolve({
    preferBuiltins: false,
    browser: true,
  }),
  commonjs(),
  replace({
    preventAssignment: true,
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
    "process.browser": "true",
  }),
]

// Note: Minification can be added later with rollup-plugin-terser if needed

const servConfig = {
  contentBase: "public",
  host: "localhost",
  port: 10001,
  open: false, // Don't auto-open browser to prevent conflicts
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
}

// Only add HTTPS if certificates exist
if (sslCertExists) {
  servConfig.https = {
    key: fs.readFileSync("./cert/localhost+1-key.pem"),
    cert: fs.readFileSync("./cert/localhost+1.pem"),
  }
  console.log("🔒 Using HTTPS with SSL certificates")
} else {
  console.log("⚠️  SSL certificates not found, using HTTP")
}

export default {
  input: "src/main.tsx",
  output: {
    dir: "public/js",
    sourcemap: !isProduction,
    format: "iife",
    intro:
      'var process = typeof process !== "undefined" ? process : { env: { NODE_ENV: "' +
      (isProduction ? "production" : "development") +
      '" }, browser: true };',
  },
  plugins: [
    ...plugins,
    copy({
      targets: [
        {
          src: "../lib/dist/processor.*",
          dest: "public/js",
        },
        {
          src: "../lib/dist/rendererWorker.*",
          dest: "public/js",
        },
      ],
    }),
    // Only include serve plugin when watching (development)
    ...(isWatching ? [serve(servConfig)] : []),
  ],
  // Optimization settings
  treeshake: {
    moduleSideEffects: false,
  },
  // Suppress warnings for common issues
  onwarn(warning, warn) {
    // Skip certain warnings
    if (warning.code === "THIS_IS_UNDEFINED") return
    if (warning.code === "CIRCULAR_DEPENDENCY") return

    // Use default for everything else
    warn(warning)
  },
}
