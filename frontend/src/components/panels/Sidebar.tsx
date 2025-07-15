import { Replays } from "~/components/panels/Replays";
import { Clips } from "~/components/panels/Clips";
import { currentSelectionStore } from "~/state/awsSelectionStore";
import { Show } from "solid-js";

export function Sidebar() {
    const store = currentSelectionStore();
    console.log('Sidebar render - currentSelectionStore:', store);
    console.log('Store data:', store?.data);
    
    return (
        <>
            <Show
                when={currentSelectionStore()}
                fallback={<div class="p-4 text-slate-500">Loading replays...</div>}
                keyed
            >
                {(store) => {
                    console.log('Show children render - store:', store);
                    return (
                        <>
                            <div class="hidden h-full w-96 overflow-y-auto py-4 pl-4 lg:block">
                                <Replays selectionStore={store} />
                            </div>
                            <div class="flex flex-col gap-8 px-4 sm:flex-row sm:gap-2 lg:hidden">
                                <Replays selectionStore={store} />
                                {/* <Clips /> */}
                            </div>
                        </>
                    );
                }}
            </Show>
        </>
    );
}
