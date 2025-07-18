import { Replays } from "~/components/panels/Replays";
import { currentSelectionStore } from "~/state/awsSelectionStore";
import { Show, createSignal } from "solid-js";
import { ReplayData } from "~/common/types";
import { ReplayStub } from "~/state/awsSelectionStore";

export function Sidebar() {
    const [isImportModalOpen, setIsImportModalOpen] = createSignal(false);
    
    async function handleFileImport(event: Event, store: any) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const replayData: ReplayData = JSON.parse(text);
            
            // Create a stub for the imported replay
            const stub: ReplayStub = {
                matchId: replayData.settings.startTimestamp || 'imported-replay',
                frameStart: 0,
                frameEnd: replayData.settings.frameCount || replayData.frames.length,
                stageId: replayData.settings.stageId,
                players: JSON.stringify(replayData.settings.playerSettings?.map(p => ({
                    playerTag: p.displayName,
                    characterId: p.externalCharacterId
                })) || []),
                playerSettings: replayData.settings.playerSettings,
                category: undefined // Imported replays don't belong to a specific category
            };

            // Set the replay data in the store
            store?.setSelectionState("selectedFileAndStub", [replayData, stub]);
            
            // Close the modal
            setIsImportModalOpen(false);
        } catch (error) {
            console.error('Error importing replay file:', error);
            alert('Error importing replay file. Please ensure it\'s a valid JSON replay file.');
        }

        // Reset the input
        input.value = '';
    }
    
    return (
        <>
            <Show
                when={currentSelectionStore()}
                fallback={<div class="p-4 text-slate-500">Loading replays...</div>}
                keyed
            >
                {(store) => {
                
                    
                    // Create a closure that captures the store
                    const handleFileImportWithStore = (event: Event) => handleFileImport(event, store);
                    
                    return (
                        <>
                            <div class="hidden h-full w-96 overflow-y-auto py-4 pl-4 lg:block">
                                <div class="mb-4">
                                    <button
                                        onClick={() => setIsImportModalOpen(true)}
                                        class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium"
                                    >
                                        Import JSON Replay
                                    </button>
                                </div>
                                <Replays selectionStore={store} />
                            </div>
                            <div class="flex flex-col gap-8 px-4 sm:flex-row sm:gap-2 lg:hidden">
                                <div class="mb-4">
                                    <button
                                        onClick={() => setIsImportModalOpen(true)}
                                        class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium"
                                    >
                                        Import JSON Replay
                                    </button>
                                </div>
                                <Replays selectionStore={store} />
                                {/* <Clips /> */}
                            </div>
                            
                            {/* Import Modal */}
                            <Show when={isImportModalOpen()}>
                                <div class="fixed inset-0 z-50 flex items-center justify-center">
                                    {/* Backdrop */}
                                    <div 
                                        class="fixed inset-0 bg-black bg-opacity-50"
                                        onClick={() => setIsImportModalOpen(false)}
                                    ></div>
                                    
                                    {/* Modal */}
                                    <div class="relative bg-white rounded-lg p-6 max-w-md w-full mx-4">
                                        <div class="text-lg font-semibold mb-4">Import JSON Replay</div>
                                        
                                        <div class="text-sm text-slate-600 mb-4">
                                            Select a JSON replay file to import. This will load the full replay data directly into the viewer.
                                        </div>
                                        
                                        <label class="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm inline-block">
                                            Choose File
                                            <input
                                                type="file"
                                                accept=".json"
                                                class="hidden"
                                                onChange={handleFileImportWithStore}
                                            />
                                        </label>
                                        
                                        <div class="flex justify-end mt-6">
                                            <button
                                                onClick={() => setIsImportModalOpen(false)}
                                                class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Show>
                        </>
                    );
                }}
            </Show>
        </>
    );
}
