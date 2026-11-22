import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Ignore missing .env.local
}
try {
  process.loadEnvFile?.(".env");
} catch {
  // Ignore missing .env
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
