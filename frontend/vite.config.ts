import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  assetsInclude: [/.*zip$/, /.*ttf$/],
  plugins: [solidPlugin(), viteTsconfigPaths()],
  resolve: {
    conditions: ["browser"],
  },
  build: {
    // Ensure all build output goes to dist folder
    outDir: "dist",
    // Ensure assets are placed in a subdirectory of dist
    assetsDir: "assets",
    // Generate manifest for asset mapping
    manifest: false,
    // Don't emit separate CSS files, inline them
    cssCodeSplit: false,
    // Ensure all chunks go to the same directory
    rollupOptions: {
      output: {
        // Put all chunks in the same directory structure
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    }
  }
});
