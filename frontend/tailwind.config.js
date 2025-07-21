/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slippi: {
          50: "#BFE5CB",
          100: "#B1DFBF",
          200: "#94D4A7",
          300: "#77C890",
          400: "#59BC78",
          500: "#44A963",
          600: "#34814C",
          700: "#245934",
          800: "#14311D",
          900: "#040905",
        },
        // Dark theme palette
        void: {
          50: "#E6E5F0",
          100: "#C9C6DB",
          200: "#9892B7",
          300: "#675E92",
          400: "#36296E",
          500: "#0B0A1C", // Main void color
          600: "#090817",
          700: "#070613",
          800: "#05040E",
          900: "#030209",
        },
        ultraviolet: {
          50: "#F2E5FF",
          100: "#E5CCFF",
          200: "#CC99FF",
          300: "#B266FF",
          400: "#9933FF",
          500: "#6000FF", // Main ultraviolet color
          600: "#5500E5",
          700: "#4A00CC",
          800: "#3F00B2",
          900: "#330099",
        },
        "venom-magenta": {
          50: "#FCE5F7",
          100: "#F9CCEF",
          200: "#F399DF",
          300: "#ED66CF",
          400: "#E733BF",
          500: "#D000FF", // Main venom-magenta color
          600: "#BB00E5",
          700: "#A600CC",
          800: "#9100B2",
          900: "#7C0099",
        },
        "ecto-green": {
          50: "#E5FCF4",
          100: "#CCF9E9",
          200: "#99F3D3",
          300: "#66EDBD",
          400: "#33E7A7",
          500: "#00E887", // Main ecto-green color
          600: "#00D179",
          700: "#00BA6B",
          800: "#00A35D",
          900: "#008C4F",
        },
        "charred-graphite": {
          50: "#F7F7F7",
          100: "#EFEFEF",
          200: "#DFDFDF",
          300: "#CFCFCF",
          400: "#BFBFBF",
          500: "#4A4A4A", // Main charred-graphite color
          600: "#424242",
          700: "#3A3A3A",
          800: "#323232",
          900: "#2A2A2A",
        },
      },
      animation: {
        draw: "draw 2s ease-in-out forwards",
      },
      keyframes: {
        draw: {
          to: { "stroke-dashoffset": 0 },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class', // Enable dark mode with class strategy
};
