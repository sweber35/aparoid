import { themeStore } from "~/state/themeStore";

export function ThemeToggle() {
  return (
    <button
      onClick={() => themeStore.toggleTheme()}
      class="group relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-theme-primary bg-theme-secondary transition-all duration-300 hover:bg-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
      title={`Switch to ${themeStore.isDark() ? "light" : "dark"} theme`}
    >
      {/* Sun icon for light theme */}
      <svg
        class={`absolute h-5 w-5 transform transition-all duration-500 ${
          themeStore.isDark() 
            ? "rotate-90 scale-0 opacity-0" 
            : "rotate-0 scale-100 opacity-100"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      
      {/* Moon icon for dark theme */}
      <svg
        class={`absolute h-5 w-5 transform transition-all duration-500 ${
          themeStore.isDark() 
            ? "rotate-0 scale-100 opacity-100" 
            : "-rotate-90 scale-0 opacity-0"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
      
      {/* Gradient background effect for dark theme */}
      <div
        class={`absolute inset-0 rounded-lg bg-gradient-to-tr from-ultraviolet-500 via-venom-magenta-500 to-ecto-green-500 opacity-0 transition-opacity duration-300 ${
          themeStore.isDark() ? "group-hover:opacity-20" : ""
        }`}
      />
    </button>
  );
} 