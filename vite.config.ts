import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Stable third-party chunk: cached long-term, keeps app code in index.
        manualChunks: (id) => {
          if (
            /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/.test(id)
          )
            return "vendor";
        },
      },
    },
  },
});
