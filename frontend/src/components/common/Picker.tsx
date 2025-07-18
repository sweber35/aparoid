import { For, JSX } from "solid-js";
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
                  class={`absolute top-0 left-0 w-full overflow-hidden whitespace-nowrap border border-theme-primary p-1 transition-colors duration-200 ${
                    themeStore.isDark() 
                      ? 'hover:bg-ultraviolet-600 hover:bg-opacity-40' 
                      : 'hover:bg-slate-100'
                  }`}
                  style={{ 
                    transform: `translateY(${item.start}px)`,
                    ...(themeStore.isDark() 
                      ? {
                          backgroundColor: props.selected(stub, item.index) ? '#6000FF' : '#0B0A1C', // ultraviolet for selected, void for unselected
                          color: '#ffffff', // white text for contrast in dark mode
                          borderColor: '#4A4A4A', // charred-graphite border
                          backgroundImage: 'none', // Override any inherited backgrounds
                          background: props.selected(stub, item.index) ? '#6000FF' : '#0B0A1C' // Force background override
                        }
                      : props.selected(stub, item.index) 
                        ? { backgroundColor: 'rgb(226 232 240)', color: 'inherit' } // slate-200 for light mode selected
                        : {})
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
        </div>
      </div>
    </>
  );
}
