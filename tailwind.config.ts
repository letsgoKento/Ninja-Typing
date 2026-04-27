import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/data/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        "neon-cyan": "0 0 28px rgba(34, 211, 238, 0.26)",
        "neon-red": "0 0 28px rgba(248, 113, 113, 0.3)",
        "panel": "0 24px 90px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
