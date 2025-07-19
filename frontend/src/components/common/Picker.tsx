import { For, JSX, createSignal, createEffect } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { themeStore } from "~/state/themeStore";

export function Picker<T>(props: {
  items: T[];
  render: (item: T, index: number) => JSX.Element;
  onClick: (item: T, index: number) => unknown;
  selected: (item: T, index: number) => boolean;
  estimateSize: (item: T, index: number) => number;
}) {
  let scrollParentRef: HTMLDivElement | undefined;
  
  // Track previous and current selected indices for animation
  const [prevSelectedIndex, setPrevSelectedIndex] = createSignal<number | null>(null);
  const [currentSelectedIndex, setCurrentSelectedIndex] = createSignal<number | null>(null);
  const [isAnimating, setIsAnimating] = createSignal(false);
  const [animationDirection, setAnimationDirection] = createSignal<'up' | 'down' | null>(null);
  
  // Update selected indices when selection changes
  createEffect(() => {
    const newSelectedIndex = props.items.findIndex((item, index) => props.selected(item, index));
    if (newSelectedIndex !== -1 && newSelectedIndex !== currentSelectedIndex()) {
      const prev = currentSelectedIndex();
      setPrevSelectedIndex(prev);
      setCurrentSelectedIndex(newSelectedIndex);
      
      // Check if animation should occur (within 6 items)
      if (prev !== null && Math.abs(newSelectedIndex - prev) <= 6) {
        setAnimationDirection(newSelectedIndex > prev ? 'down' : 'up');
        setIsAnimating(true);
        // Reset animation flag after animation completes
        setTimeout(() => {
          setIsAnimating(false);
          setAnimationDirection(null);
        }, 300);
      }
    }
  });

  const virtualizer = createVirtualizer({
    get count() {
      return props.items.length;
    },
    getScrollElement: () => scrollParentRef,
    estimateSize: (index: number) =>
      props.estimateSize(props.items[index], index),
    overscan: 25,
  });

  return (
    <>
      <div ref={scrollParentRef} class={`w-full overflow-auto ${themeStore.isDark() ? 'bg-void-500' : ''}`}>
        <div
          class="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          <For each={virtualizer.getVirtualItems()}>
            {/* item is VirtualItem */}
            {(item: { start: number; index: number }) => {
              const stub = props.items[item.index];
              // Use a unique key for each replay stub if possible (for debugging, not as a prop)
              let debugKey = String(item.index);
              if (
                stub &&
                typeof stub === "object" &&
                "matchId" in stub &&
                "frameStart" in stub &&
                "frameEnd" in stub
              ) {
                debugKey = `${(stub as any).matchId}-${(stub as any).frameStart}-${(stub as any).frameEnd}`;
              }
              return (
                <div
                  role="button"
                  class={`absolute top-0 left-0 w-full overflow-hidden whitespace-nowrap p-1 transition-colors duration-200 ${
                    themeStore.isDark() 
                      ? 'hover:bg-ultraviolet-600 hover:bg-opacity-40' 
                      : 'hover:bg-slate-100'
                  }`}
                  style={{ 
                    transform: `translateY(${item.start}px)`,
                    ...(themeStore.isDark() 
                      ? {
                          backgroundColor: '#0B0A1C', // void for all items
                          color: '#ffffff', // white text for contrast in dark mode
                          border: '1px solid #4A4A4A', // normal border for all sides
                          backgroundImage: 'none', // Override any inherited backgrounds
                          background: '#0B0A1C' // Force background override
                        }
                      : props.selected(stub, item.index) 
                        ? { 
                            backgroundColor: '#ffffff', // white background for selected in light mode
                            border: '1px solid #e2e8f0', // normal border for all sides
                            color: 'inherit' 
                          }
                        : {
                            border: '1px solid #e2e8f0' // normal border for unselected in light mode
                          })
                  }}
                  classList={{
                    'hover:bg-slate-300': !themeStore.isDark() && props.selected(stub, item.index),
                  }}
                  onClick={() => props.onClick(stub, item.index)}
                >
                  {props.render(stub, item.index)}
                </div>
              );
            }}
          </For>
          
          {/* Single animated green stripe that moves between positions */}
          {currentSelectedIndex() !== null && (
            <div 
              style={{
                position: 'absolute',
                left: '-1px',
                top: `${virtualizer.getVirtualItems().find((item: { start: number; index: number }) => item.index === currentSelectedIndex())?.start || 0}px`,
                height: `${props.estimateSize(props.items[currentSelectedIndex()!], currentSelectedIndex()!)}px`,
                width: '4px',
                'background-color': '#00E887',
                'z-index': '10',
                'pointer-events': 'none',
                transition: isAnimating() ? 'top 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
