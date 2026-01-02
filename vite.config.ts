import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Library build mode (for publishing as npm package)
  if (mode === 'lib') {
    return {
      plugins: [react()],
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/lib-index.ts'),
          name: 'StringSightFrontend',
          formats: ['es', 'cjs'],
          fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`
        },
        rollupOptions: {
          // Externalize dependencies that shouldn't be bundled
          external: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
            '@tanstack/react-query',
            '@tanstack/react-table',
            'plotly.js-dist-min',
            'react-plotly.js'
          ],
          output: {
            // Globals for UMD build (if needed)
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'jsxRuntime'
            }
          }
        },
        // Generate TypeScript declarations
        // Note: You may need to add 'vite-plugin-dts' for full type generation
        sourcemap: true
      }
    }
  }

  // Regular app build mode (default)
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5180,
      proxy: {
        // Proxy API requests to the backend to avoid CORS and ad-blockers
        '/api': {
          target: env.VITE_BACKEND || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
          // Set high timeouts for long-running operations like clustering
          timeout: 600000, // 10 minutes for the request to connect
          proxyTimeout: 600000, // 10 minutes for the response to complete
        },
      },
    },
  }
})
