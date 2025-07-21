import { Replays, Controls } from "~/components/panels/Replays";
import { currentSelectionStore } from "~/state/awsSelectionStore";
import { Show, createSignal } from "solid-js";
import { ReplayData } from "~/common/types";
import { ReplayStub } from "~/state/awsSelectionStore";
import { ThemeToggle } from "~/components/common/ThemeToggle";
import { MobileMenu } from "~/components/common/MobileMenu";
import { themeStore } from "~/state/themeStore";

export function Sidebar() {
    const [isImportModalOpen, setIsImportModalOpen] = createSignal(false);
    
    // use a static ID since this component is only rendered once
    const loadingSpinnerId = `loading_sidebar_static`;
    
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

    // Mobile menu content component
    function MobileMenuContent() {
        return (
            <>
                {/* Theme Toggle Section */}
                <div class="space-y-2">
                    <h3 class="text-sm font-medium text-theme-primary">Theme</h3>
                    <div class="flex items-center justify-between p-3 rounded-lg bg-theme-secondary">
                        <span class="text-sm text-theme-secondary">Dark Mode</span>
                        <ThemeToggle />
                    </div>
                </div>

                {/* Controls Section */}
                <div class="space-y-2">
                    <h3 class="text-sm font-medium text-theme-primary">Controls</h3>
                    <div class="p-3 rounded-lg bg-theme-secondary">
                        <Controls selectionStore={currentSelectionStore()!} />
                    </div>
                </div>

                {/* Import Section */}
                <div class="space-y-2">
                    <h3 class="text-sm font-medium text-theme-primary">Import</h3>
                    <div class="space-y-2">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            class={`w-full px-4 py-2 rounded text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                themeStore.isDark() 
                                    ? 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus:ring-accent-primary' 
                                    : 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus:ring-accent-primary'
                            }`}
                        >
                            Import JSON Replay
                        </button>
                        
                        <label class={`w-full px-4 py-2 rounded text-sm font-medium cursor-pointer inline-block text-center transition-colors duration-200 ${
                            themeStore.isDark() 
                                ? 'bg-ecto-green-500 hover:bg-ecto-green-600 text-void-600 focus-within:ring-2 focus-within:ring-ecto-green-500 focus-within:ring-offset-2' 
                                : 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2'
                        }`}>
                            Upload .slp files
                            <input type="file" multiple accept=".slp" class="hidden" />
                        </label>
                    </div>
                </div>
            </>
        );
    }
    
    return (
        <>
            <Show
                when={currentSelectionStore()}
                keyed
                fallback={
                    <div class="Sidebar">
                        {/* Header with theme toggle */}
                        <div class="ThemeToggle">
                            <h2 class="text-lg font-semibold text-theme-primary">Aparoid</h2>
                            <ThemeToggle />
                        </div>
                        
                        {/* Loading state */}
                        <div class="Replays">
                            <div class="flex-1 flex items-center justify-center">
                                <div class="flex flex-col items-center gap-4">
                                    <svg width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="1" y="1" rx="1" width="10" height="10" fill={themeStore.isDark() ? "#00E887" : "#9CA3AF"}>
                                        <animate id={`${loadingSpinnerId}_1`} begin={`0;${loadingSpinnerId}_8.end`} attributeName="x" dur="0.2s" values="1;13" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_2`} begin={`${loadingSpinnerId}_5.end`} attributeName="y" dur="0.2s" values="1;13" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_3`} begin={`${loadingSpinnerId}_6.end`} attributeName="x" dur="0.2s" values="13;1" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_4`} begin={`${loadingSpinnerId}_7.end`} attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                                      </rect>
                                      <rect x="1" y="13" rx="1" width="10" height="10" fill={themeStore.isDark() ? "#00E887" : "#9CA3AF"}>
                                        <animate id={`${loadingSpinnerId}_5`} begin={`${loadingSpinnerId}_1.end`} attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_6`} begin={`${loadingSpinnerId}_2.end`} attributeName="x" dur="0.2s" values="1;13" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_7`} begin={`${loadingSpinnerId}_3.end`} attributeName="y" dur="0.2s" values="1;13" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_8`} begin={`${loadingSpinnerId}_4.end`} attributeName="x" dur="0.2s" values="13;1" fill="freeze" />
                                      </rect>
                                      <rect x="13" y="13" rx="1" width="10" height="10" fill={themeStore.isDark() ? "#00E887" : "#9CA3AF"}>
                                        <animate id={`${loadingSpinnerId}_9`} begin={`${loadingSpinnerId}_5.end`} attributeName="x" dur="0.2s" values="13;1" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_10`} begin={`${loadingSpinnerId}_6.end`} attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_11`} begin={`${loadingSpinnerId}_7.end`} attributeName="x" dur="0.2s" values="1;13" fill="freeze" />
                                        <animate id={`${loadingSpinnerId}_12`} begin={`${loadingSpinnerId}_8.end`} attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                                      </rect>
                                    </svg>
                                    <div class="text-theme-secondary">Loading replays...</div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Import buttons */}
                        <div class="ImportButtons">
                            <button
                                class={`w-full px-4 py-2 rounded text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    themeStore.isDark() 
                                        ? 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus:ring-accent-primary' 
                                        : 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus:ring-accent-primary'
                                }`}
                                onClick={() => setIsImportModalOpen(true)}
                            >
                                Import JSON Replay
                            </button>
                            
                            <label class={`w-full px-4 py-2 rounded text-sm font-medium cursor-pointer inline-block text-center transition-colors duration-200 ${
                                themeStore.isDark() 
                                    ? 'bg-ecto-green-500 hover:bg-ecto-green-600 text-void-900 focus-within:ring-2 focus-within:ring-ecto-green-500 focus-within:ring-offset-2' 
                                    : 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2'
                            }`}>
                                Upload .slp files
                                <input type="file" multiple accept=".slp" class="hidden" />
                            </label>
                        </div>
                    </div>
                }
            >
                {(store) => (
                    <div class="Sidebar">
                        {/* Header with theme toggle */}
                        <div class="ThemeToggle">
                            <h2 class="text-lg font-semibold text-theme-primary">Replays</h2>
                            <ThemeToggle />
                        </div>
                        
                        {/* Replays content */}
                        <div class="Replays">
                            <Replays selectionStore={store} />
                        </div>
                        
                        {/* Import buttons */}
                        <div class="ImportButtons">
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                class={`w-full px-4 py-2 rounded text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    themeStore.isDark() 
                                        ? 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus:ring-accent-primary' 
                                        : 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus:ring-accent-primary'
                                }`}
                            >
                                Import JSON Replay
                            </button>
                            
                            <label class={`w-full px-4 py-2 rounded text-sm font-medium cursor-pointer inline-block text-center transition-colors duration-200 ${
                                themeStore.isDark() 
                                    ? 'bg-ecto-green-500 hover:bg-ecto-green-600 text-void-600 focus-within:ring-2 focus-within:ring-ecto-green-500 focus-within:ring-offset-2' 
                                    : 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2'
                            }`}>
                                Upload .slp files
                                <input type="file" multiple accept=".slp" class="hidden" />
                            </label>
                        </div>
                    </div>
                )}
            </Show>

            {/* Mobile Menu */}
            <MobileMenu>
                <MobileMenuContent />
            </MobileMenu>

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
                        
                        <label class={`cursor-pointer px-4 py-2 rounded text-sm inline-block transition-colors duration-200 focus-within:ring-2 focus-within:ring-offset-2 ${
                            themeStore.isDark() 
                                ? 'bg-accent-primary hover:bg-ultraviolet-600 text-white focus-within:ring-accent-primary' 
                                : 'bg-white border border-accent-primary text-accent-primary hover:bg-accent-primary hover:text-white focus-within:ring-accent-primary'
                        }`}>
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
