import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr' // Import svgr

export default defineConfig({
  plugins: [
    react(),
    svgr({
      // svgr options: https://react-svgr.com/docs/options/
      svgrOptions: {
        // You can add options here if needed, e.g.,
        // icon: true, // Use 'icon' size attribute
      },
      // esbuild options, if needed
      esbuildOptions: {},
      // Specify files to include or exclude
      include: "**/*.svg", // Default: Process all .svg files
      exclude: "",
    })
  ],
  // Ensure server settings allow backend communication if needed
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'http://localhost:5001', // Your backend address
  //       changeOrigin: true,
  //       secure: false, // Set to true if backend uses HTTPS
  //     }
  //   }
  // }
})