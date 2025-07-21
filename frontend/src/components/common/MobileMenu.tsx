import { createSignal, Show, JSX } from "solid-js";
import { ThemeToggle } from "./ThemeToggle";
import { themeStore } from "~/state/themeStore";

interface MobileMenuProps {
  children: JSX.Element;
}

export function MobileMenu(props: MobileMenuProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <>
      {/* Mobile menu button - only visible on mobile landscape */}
      <div class="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen())}
          class={`p-2 rounded-lg transition-colors duration-200 opacity-60 hover:opacity-100 ${
            themeStore.isDark() 
              ? 'bg-void-500 hover:bg-void-400 text-white' 
              : 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary'
          }`}
          aria-label="Toggle menu"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke-width="1.5" 
            stroke="currentColor" 
            class="w-6 h-6"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              d={isOpen() 
                ? "M6 18L18 6M6 6l12 12" 
                : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              } 
            />
          </svg>
        </button>
      </div>

      {/* Mobile menu overlay */}
      <Show when={isOpen()}>
        <div 
          class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      </Show>

      {/* Mobile menu content */}
      <div 
        class={`lg:hidden fixed top-0 left-0 h-full w-80 max-w-[80vw] z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen() ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div class={`h-full w-full ${themeStore.isDark() ? 'bg-void-500' : 'bg-theme-primary'} border-r border-theme-primary overflow-y-auto`}>
          {/* Menu header */}
          <div class="flex items-center justify-between p-4 border-b border-theme-primary">
            <h2 class="text-lg font-semibold text-theme-primary">Menu</h2>
            <button
              onClick={() => setIsOpen(false)}
              class={`p-1 rounded transition-colors duration-200 ${
                themeStore.isDark() 
                  ? 'hover:bg-void-400 text-white' 
                  : 'hover:bg-theme-secondary text-theme-primary'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu content */}
          <div class="p-4 space-y-6">
            {props.children}
          </div>
        </div>
      </div>
    </>
  );
} 