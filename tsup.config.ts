import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: {
    resolve: true,
    compilerOptions: {
      skipLibCheck: true,
    },
  },
  sourcemap: true,
  clean: true,
  external: [
    "@larksuiteoapi/node-sdk",
    "http-proxy-agent",
    "https-proxy-agent",
    "zod",
  ],
})
