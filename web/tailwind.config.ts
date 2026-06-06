import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cute meme pastel palette.
        bark: {
          cream: "#FFF7ED",
          peach: "#FFE4CC",
          honey: "#FFD79A",
          sun: "#FFC83D",
          coral: "#FF8C69",
          bubble: "#FF6FB5",
          grape: "#A78BFA",
          sky: "#7DD3FC",
          mint: "#86EFAC",
          ink: "#3B2F2F",
        },
      },
      fontFamily: {
        display: ["Baloo 2", "Comic Sans MS", "cursive"],
        body: ["Quicksand", "system-ui", "sans-serif"],
      },
      borderRadius: {
        blob: "2rem",
      },
      boxShadow: {
        cute: "0 8px 0 0 rgba(59,47,47,0.12)",
        pop: "0 6px 0 0 #3B2F2F",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pop: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        wiggle: "wiggle 1s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        pop: "pop 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
