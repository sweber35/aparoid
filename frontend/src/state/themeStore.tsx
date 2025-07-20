import { createSignal, createEffect } from "solid-js";

export type Theme = "light" | "dark";

// Create the theme signal with persistence
const [theme, setTheme] = createSignal<Theme>(
  (localStorage.getItem("theme") as Theme) || "dark"
);

// Apply theme to document when it changes
createEffect(() => {
  const currentTheme = theme();
  
  // Remove existing theme classes
  document.documentElement.classList.remove("light", "dark");
  
  // Add current theme class
  document.documentElement.classList.add(currentTheme);
  
  // Persist to localStorage
  localStorage.setItem("theme", currentTheme);
});

// Theme store exports
export const themeStore = {
  get theme() {
    return theme();
  },
  
  setTheme,
  
  toggleTheme() {
    setTheme(theme() === "light" ? "dark" : "light");
  },
  
  isDark() {
    return theme() === "dark";
  },
  
  isLight() {
    return theme() === "light";
  }
};

// Initialize theme on first load
if (typeof window !== "undefined") {
  // Check for system preference if no saved theme
  if (!localStorage.getItem("theme")) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }
  
  // Apply initial theme
  document.documentElement.classList.add(theme());
} 