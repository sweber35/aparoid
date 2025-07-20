import { For, JSX, createSignal, createEffect, createMemo } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { themeStore } from "~/state/themeStore";

export function Picker<T>(props: {
  items: T[];
  render: (item: T, index: number) => JSX.Element;
  onClick: (item: T, index: number) => unknown;
  selected: (item: T, index: number) => boolean;
  estimateSize: (item: T, index: number) => number;
  variant?: 'default' | 'mobile';
}) {
  let scrollParentRef: HTMLDivElement | undefined;
  
  // Track previous and current selected indices for animation
  const [prevSelectedIndex, setPrevSelectedIndex] = createSignal<number | null>(null);
  const [currentSelectedIndex, setCurrentSelectedIndex] = createSignal<number | null>(null);
  const [isAnimating, setIsAnimating] = createSignal(false);
  const [animationDirection, setAnimationDirection] = createSignal<'up' | 'down' | null>(null);
  
  // Detect mobile landscape mode
  const isMobileLandscape = createMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight && window.innerWidth < 1024;
  });
  
  // Responsive styles based on variant and screen size
  const pickerStyles = createMemo(() => {
    const isMobile = props.variant === 'mobile' || isMobileLandscape();
    
    return {
      container: {
        width: '100%',
        height: '100%',
        overflow: 'auto' as const,
        'background-color': themeStore.isDark() ? '#0B0A1C' : 'transparent',
        padding: isMobile ? '0' : undefined,
        margin: isMobile ? '0' : undefined,
      },
      item: {
        position: 'absolute' as const,
        top: '0',
        left: '0',
        width: '100%',
        overflow: 'hidden' as const,
        'white-space': 'nowrap' as const,
        transition: 'colors 0.2s',
        padding: isMobile ? '0.5rem' : undefined,
        'font-size': isMobile ? '0.875rem' : undefined,
      },
      stripe: {
        position: 'absolute' as const,
        left: '-1px',
        height: isMobile ? '96px' : '96px', // Match the actual content height
        width: '5px',
        'background-color': themeStore.isDark() ? '#00E887' : '#44A963',
        'z-index': '10',
        'pointer-events': 'none' as const,
      }
    };
  });
  
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
      <div ref={scrollParentRef} style={pickerStyles().container}>
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
              
              const isSelected = props.selected(stub, item.index);
              const styles = pickerStyles();
              
              return (
                <div
                  role="button"
                  class={`transition-colors duration-200 ${
                    themeStore.isDark() 
                      ? 'hover:bg-ultraviolet-600 hover:bg-opacity-40' 
                      : 'hover:bg-slate-100'
                  }`}
                  style={{ 
                    ...styles.item,
                    transform: `translateY(${item.start}px)`,
                    'background-color': themeStore.isDark() 
                      ? '#0B0A1C'
                      : isSelected 
                        ? '#ffffff' 
                        : 'transparent',
                    color: themeStore.isDark() ? '#ffffff' : 'inherit',
                    'border-bottom': themeStore.isDark() 
                      ? '1px solid #2A2A2A'
                      : '1px solid #e5e7eb',
                    'background-image': 'none',
                  }}
                  classList={{
                    'hover:bg-slate-300': !themeStore.isDark() && isSelected,
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
                ...pickerStyles().stripe,
                top: `${virtualizer.getVirtualItems().find((item: { start: number; index: number }) => item.index === currentSelectedIndex())?.start || 0}px`,
                transition: isAnimating() ? 'top 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
