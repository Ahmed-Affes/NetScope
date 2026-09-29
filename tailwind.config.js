/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#07090d",
        foreground: "#e6edf3",
        muted: {
          DEFAULT: "rgba(125, 133, 144, 0.2)",
          foreground: "#7d8590",
        },
        panel: {
          DEFAULT: "rgba(14, 18, 26, 0.72)",
          border: "rgba(255, 255, 255, 0.06)",
        },
        node: {
          host: "#22d3ee",
          gateway: "#fb923c",
          lan: "#34d399",
          docker: "#a78bfa",
          internet: "#60a5fa",
          tailscale: "#2dd4bf",
          monitor: "#facc15",
          threat: "#ef4444",
          process: "#e879f9",
        },
        link: {
          ssh: "#f87171",
          http: "#4ade80",
          https: "#38bdf8",
          dns: "#fbbf24",
          neo4j: "#c084fc",
          ollama: "#818cf8",
          udp: "#94a3b8",
          tcp: "#64748b",
        }
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "Monaco", "'Courier New'", "monospace"],
      },
      borderRadius: {
        panel: "10px",
      },
      backdropBlur: {
        panel: "12px",
      }
    },
  },
  plugins: [],
}
