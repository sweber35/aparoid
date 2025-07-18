import { Replays } from "~/components/panels/Replays";
import { currentSelectionStore } from "~/state/awsSelectionStore";
import { Show, createSignal } from "solid-js";
import { ReplayData } from "~/common/types";
import { ReplayStub } from "~/state/awsSelectionStore";
import { ThemeToggle } from "~/components/common/ThemeToggle";

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
                keyed
                fallback={
                    <div class="flex h-screen w-full flex-col justify-between bg-theme-secondary border-r border-theme-primary lg:w-80">
                        {/* Header with theme toggle */}
                        <div class="flex items-center justify-between p-4 border-b border-theme-primary">
                            <h2 class="text-lg font-semibold text-theme-primary">Aparoid</h2>
                            <ThemeToggle />
                        </div>
                        
                        {/* Loading state */}
                        <div class="flex-1 flex items-center justify-center">
                            <div class="text-theme-secondary">Loading replays...</div>
                        </div>
                        
                        {/* Import buttons */}
                        <div class="p-4 space-y-3 border-t border-theme-primary">
                            <button
                                class="w-full bg-accent-primary hover:bg-ultraviolet-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
                                onClick={() => setIsImportModalOpen(true)}
                            >
                                Import JSON Replay
                            </button>
                            
                            <label class="w-full bg-ecto-green-500 hover:bg-ecto-green-600 text-void-900 px-4 py-2 rounded text-sm font-medium cursor-pointer inline-block text-center transition-colors duration-200 focus-within:ring-2 focus-within:ring-ecto-green-500 focus-within:ring-offset-2">
                                Upload .slp files
                                <input type="file" multiple accept=".slp" class="hidden" />
                            </label>
                        </div>
                    </div>
                }
            >
                {(store) => (
                    <>
                        {/* Desktop Layout */}
                        <div class="hidden h-screen w-full bg-theme-secondary border-r border-theme-primary lg:block lg:w-80">
                            {/* Header with theme toggle */}
                            <div class="flex items-center justify-between p-4 border-b border-theme-primary">
                                <h2 class="text-lg font-semibold text-theme-primary">Replays</h2>
                                <ThemeToggle />
                            </div>
                            
                            {/* Replays content */}
                            <div class="flex-1 overflow-y-auto max-h-[calc(100vh-200px)]">
                                <Replays selectionStore={store} />
                            </div>
                            
                            {/* Import buttons */}
                            <div class="p-4 space-y-3 border-t border-theme-primary">
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    class="w-full bg-accent-primary hover:bg-ultraviolet-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
                                >
                                    Import JSON Replay
                                </button>
                                
                                <label class="w-full bg-ecto-green-500 hover:bg-ecto-green-600 text-void-900 px-4 py-2 rounded text-sm font-medium cursor-pointer inline-block text-center transition-colors duration-200 focus-within:ring-2 focus-within:ring-ecto-green-500 focus-within:ring-offset-2">
                                    Upload .slp files
                                    <input type="file" multiple accept=".slp" class="hidden" />
                                </label>
                            </div>
                        </div>

                        {/* Mobile Layout */}
                        <div class="flex flex-col gap-8 px-4 sm:flex-row sm:gap-2 lg:hidden">
                            {/* Header with theme toggle */}
                            <div class="flex items-center justify-between mb-4">
                                <h2 class="text-lg font-semibold text-theme-primary">Replays</h2>
                                <ThemeToggle />
                            </div>
                            
                            <Replays selectionStore={store} />
                            
                            {/* Import buttons */}
                            <div class="mt-4 space-y-3">
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    class="w-full bg-accent-primary hover:bg-ultraviolet-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
                                >
                                    Import JSON Replay
                                </button>
                                
                                <label class="w-full bg-ecto-green-500 hover:bg-ecto-green-600 text-void-900 px-4 py-2 rounded text-sm font-medium cursor-pointer inline-block text-center transition-colors duration-200 focus-within:ring-2 focus-within:ring-ecto-green-500 focus-within:ring-offset-2">
                                    Upload .slp files
                                    <input type="file" multiple accept=".slp" class="hidden" />
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </Show>

            {/* Import Modal */}
            <Show when={isImportModalOpen()}>
                <div 
                    class="fixed inset-0 bg-void-500 bg-opacity-75 flex items-center justify-center z-50"
                    onClick={(e) => e.target === e.currentTarget && setIsImportModalOpen(false)}
                >
                    <div class="relative bg-theme-primary border border-theme-primary rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div class="text-lg font-semibold mb-4 text-theme-primary">Import JSON Replay</div>
                        
                        <div class="text-sm text-theme-secondary mb-4">
                            Select a JSON replay file to import and view.
                        </div>
                        
                        <label class="cursor-pointer bg-accent-primary hover:bg-ultraviolet-600 text-white px-4 py-2 rounded text-sm inline-block transition-colors duration-200 focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2">
                            Choose JSON File
                            <input
                                type="file"
                                accept=".json"
                                class="hidden"
                                onChange={(e) => handleFileImport(e, currentSelectionStore())}
                            />
                        </label>
                        
                        <div class="flex justify-end mt-6 space-x-3">
                            <button
                                onClick={() => setIsImportModalOpen(false)}
                                class="bg-charred-graphite-500 hover:bg-charred-graphite-600 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-charred-graphite-500 focus:ring-offset-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </>
    );
}
