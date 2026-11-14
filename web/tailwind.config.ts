import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        leaf: { 50: "#f1f8f2", 100: "#dcefe0", 200: "#b8dfc1", 500: "#3f8f55", 600: "#2f7444", 700: "#265d38", 800: "#1f4a2e", 900: "#173823" },
        soil: { 50: "#faf6f1", 100: "#f1e7da", 300: "#d6b996", 500: "#a87a4b", 700: "#6e4c2b" },
        sky: { 50: "#eef6fb", 500: "#2b7bb9", 700: "#1d5a8a" },
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
