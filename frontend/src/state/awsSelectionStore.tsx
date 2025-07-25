import { createStore } from "solid-js/store";
import { createEffect, createSignal, on } from "solid-js";
import { ReplayData, Frame } from "~/common/types";
import { stageNameByExternalId, ExternalStageName } from "~/common/ids";
import { API_CONFIG } from "~/config";

export type ActionState = 'CLIFF_WAIT' | 'FALL' | 'JUMP' |
                          'AIR_DODGE' | 'IDLE' | 'SHINE_START' |
                          'SHINE_WAIT' | 'JUMP_SQUAT' | 'GRAB';

export type Category = 'Ledge Dashes' | 'Shine Grabs' | 'Combos (Length)' | 'Combos (Percent)';

// Mapping from categories to action state sequences or combo types
export const categoryToActionSequence: Record<Category, {action: ActionState, minFrames?: number, maxFrames?: number}[] | {comboType: string}> = {
    'Ledge Dashes': [
        { action: 'CLIFF_WAIT', minFrames: 7 },
        { action: 'FALL', minFrames: 1, maxFrames: 3 },
        { action: 'JUMP', minFrames: 1, maxFrames: 5 },
        { action: 'AIR_DODGE' }
    ],

    'Shine Grabs': [
        { action: 'SHINE_START', minFrames: 1, maxFrames: 5 },
        { action: 'SHINE_WAIT', minFrames: 1, maxFrames: 5 },
        { action: 'JUMP_SQUAT', minFrames: 1, maxFrames: 8 },
        { action: 'GRAB'}
    ],

    'Combos (Length)': { comboType: 'length' },
    'Combos (Percent)': { comboType: 'damage' },
};

export type Filter = 
  | { type: "stage"; label: ExternalStageName }
  | { type: "codeOrName"; label: string };

export async function loadStubsForActionSequence(actionSequence: {action: ActionState, minFrames?: number, maxFrames?: number}[]): Promise<ReplayStub[]> {
    const res = await fetch(API_CONFIG.replayStub, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            queryType: 'sequence',
            actions: actionSequence 
        }),
    });

    const payload = await res.json();

    // Start a background request to get fresh results after a short delay
    setTimeout(async () => {
        try {
            const freshRes = await fetch(API_CONFIG.replayStub, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    queryType: 'sequence',
                    actions: actionSequence 
                }),
            });

            const freshPayload = await freshRes.json();
            
            // Update the store with fresh results if they're different
            const category = currentCategory();
            if (categoryStores[category]) {
                categoryStores[category].setSelectionState("stubs", freshPayload);
            }
        } catch (error) {
            console.error('Background refresh failed:', error);
        }
    }, 2000); // Wait 2 seconds before making the background request

    return payload;
}

export async function loadStubsForCategory(category: Category): Promise<ReplayStub[]> {
    const categoryConfig = categoryToActionSequence[category];
    
    if ('comboType' in categoryConfig) {
        // Handle combo queries
        const res = await fetch(API_CONFIG.replayStub, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                queryType: 'combo',
                comboType: categoryConfig.comboType 
            }),
        });

        const payload = await res.json();

        // Start a background request to get fresh results after a short delay
        setTimeout(async () => {
            try {
                const freshRes = await fetch(API_CONFIG.replayStub, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        queryType: 'combo',
                        comboType: categoryConfig.comboType 
                    }),
                });

                const freshPayload = await freshRes.json();
                
                // Update the store with fresh results if they're different
                const currentCat = currentCategory();
                if (categoryStores[currentCat]) {
                    categoryStores[currentCat].setSelectionState("stubs", freshPayload);
                }
            } catch (error) {
                console.error('Background refresh failed:', error);
            }
        }, 2000); // Wait 2 seconds before making the background request

        return payload;
    } else {
        // Handle sequence queries (existing logic)
        return loadStubsForActionSequence(categoryConfig);
    }
}

export interface SelectionState {
    filter?: Category;
    filters: Filter[];
    stubs: ReplayStub[];
    filteredStubs: ReplayStub[];
    selectedFileAndStub?: [ReplayData, ReplayStub];
    loadingStubKey?: string | null;
}

export interface ReplayStub {
    category?: Category;
    matchId: string;
    frameStart: number;
    frameEnd: number;
    stageId: number;
    players: string; // Format: "[{playerTag, characterId}, {playerTag, characterId}]"
    playerSettings?: {
        playerIndex: number;
        connectCode: string;
        displayName: string;
        nametag: string;
        externalCharacterId: number;
        teamId: number;
    }[];
    bugged?: boolean;
    // Combo-specific fields
    numMoves?: number;
    startPct?: number;
    endPct?: number;
    stocks?: number;
    damageDealt?: number;
}

interface StubStore {
    stubs: () => ReplayStub[];
    getReplayData: (stub: ReplayStub) => Promise<ReplayData>;
}

export type SelectionStore = ReturnType<typeof createSelectionStore>;

function createSelectionStore(stubStore: StubStore) {

    const [selectionState, setSelectionState] = createStore<SelectionState>({
        stubs: [],
        filters: [],
        filteredStubs: [],
    });

    function setFilter(filter: Category) {
        setSelectionState("filter", filter);
    }

    function setFilters(filters: Filter[]) {
        setSelectionState("filters", filters);
    }

    async function select(stub: ReplayStub) {
        console.log('Replay selection changed to match ID:', stub.matchId);
        const loadingKey = `${stub.matchId}-${stub.frameStart}-${stub.frameEnd}`;
        setSelectionState("loadingStubKey", loadingKey);
        try {
            const data = await stubStore.getReplayData(stub);
            setSelectionState("selectedFileAndStub", [data, stub]);
        } finally {
            setSelectionState("loadingStubKey", null);
        }
    }

    function nextFile() {
        const currentStub = selectionState.selectedFileAndStub?.[1];
        if (!currentStub) return;
        
        // Sort stubs so bugged stubs are at the bottom (same as Replays component)
        const sortedStubs = [...selectionState.filteredStubs].sort((a, b) => {
            return (a.bugged ? 1 : 0) - (b.bugged ? 1 : 0);
        });
        
        const currentIndex = sortedStubs.findIndex(
            stub => stub.matchId === currentStub.matchId && 
                   stub.frameStart === currentStub.frameStart && 
                   stub.frameEnd === currentStub.frameEnd
        );
        
        if (currentIndex >= 0 && currentIndex < sortedStubs.length - 1) {
            const nextStub = sortedStubs[currentIndex + 1];
            select(nextStub);
        }
    }

    function previousFile() {
        const currentStub = selectionState.selectedFileAndStub?.[1];
        if (!currentStub) return;
        
        // Sort stubs so bugged stubs are at the bottom (same as Replays component)
        const sortedStubs = [...selectionState.filteredStubs].sort((a, b) => {
            return (a.bugged ? 1 : 0) - (b.bugged ? 1 : 0);
        });
        
        const currentIndex = sortedStubs.findIndex(
            stub => stub.matchId === currentStub.matchId && 
                   stub.frameStart === currentStub.frameStart && 
                   stub.frameEnd === currentStub.frameEnd
        );
        
        if (currentIndex > 0) {
            const prevStub = sortedStubs[currentIndex - 1];
            select(prevStub);
        }
    }

    function setSelectionStateValue<K extends keyof SelectionState>(key: K, value: SelectionState[K]) {
        setSelectionState(key, value);
    }

    createEffect(() => {
        setSelectionState("stubs", stubStore.stubs());
    });

    createEffect(() => {
        // Apply filters to stubs
        const filtered = selectionState.stubs.filter((stub) => {
            const stagesAllowed = selectionState.filters
                .filter((filter) => filter.type === "stage")
                .map((filter) => filter.label);
            
            const namesNeeded = selectionState.filters
                .filter((filter) => filter.type === "codeOrName")
                .map((filter) => filter.label);

            // Check stage filter
            const stageName = stageNameByExternalId[stub.stageId];
            const stagePass = stagesAllowed.length === 0 || 
                (stageName && stagesAllowed.includes(stageName));

            // Check name filter
            const areNamesSatisfied = namesNeeded.length === 0 || namesNeeded.every((name) =>
                stub.playerSettings?.some((p) =>
                    [
                        p.connectCode?.toLowerCase(),
                        p.displayName?.toLowerCase(),
                        p.nametag?.toLowerCase(),
                    ].includes(name.toLowerCase())
                )
            );

            return stagePass && areNamesSatisfied;
        });

        setSelectionState("filteredStubs", filtered);
    });

    createEffect(
        on(
            () => stubStore.stubs(),
            () => {
                setSelectionState("selectedFileAndStub", undefined);
            }
        )
    );

    return { data: selectionState, setFilter, setFilters, select, nextFile, previousFile, setSelectionState: setSelectionStateValue };
}

const categoryStores: Record<string, SelectionStore> = {};

// Cache for replay data to prevent unnecessary refetching
const replayDataCache = new Map<string, ReplayData>();

// Debug store for full replay requests
const [debugStore, setDebugStore] = createStore({
    requestFullReplay: false
});

export function toggleFullReplayDebug(): void {
    setDebugStore("requestFullReplay", (current) => !current);
}

export function getFullReplayDebugState(): boolean {
    return debugStore.requestFullReplay;
}

// Clear cache when debug mode changes
createEffect(() => {
    debugStore.requestFullReplay;
    replayDataCache.clear();
});

export async function initCategoryStore(category: Category) {
    const stubs = await loadStubsForCategory(category);

    const [stubSignal, setStubSignal] = createSignal<ReplayStub[]>(stubs);

    categoryStores[category] = createSelectionStore({
        stubs: stubSignal,
        async getReplayData(stub): Promise<ReplayData> {
            // Create a cache key based on the stub's unique properties
            const cacheKey = `${stub.matchId}-${stub.frameStart}-${stub.frameEnd}`;
            
            // Check if we already have this replay data cached
            if (replayDataCache.has(cacheKey)) {
                return replayDataCache.get(cacheKey)!;
            }
            
            // Always send the full stub with frameStart and frameEnd
            const requestBody = stub;
            
            const result = await fetch(API_CONFIG.replayData, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!result.ok) {
                throw new Error(`Lambda fetch failed: ${result.statusText}`);
            }

            const data = await result.json();

            const replayData: ReplayData = {
                ...data
            };

            for (let i = 1; i < replayData.frames.length; i++) {
                const prev = replayData.frames[i - 1].frameNumber;
                const curr = replayData.frames[i].frameNumber;
                if (curr !== prev + 1) {
                    console.warn(`Frame gap between ${prev} and ${curr}`);
                }
            }
            // Cache the replay data
            replayDataCache.set(cacheKey, replayData);

            return replayData;
        },
    });
}

export const [currentCategory, setCurrentCategory] = createSignal<Category>("Ledge Dashes");
export const [currentSelectionStore, setCurrentSelectionStore] = createSignal<SelectionStore | undefined>(undefined);

// Initialize the first category store immediately
(async () => {
    await initCategoryStore("Ledge Dashes");
    setCurrentSelectionStore(categoryStores["Ledge Dashes"]);
})();

createEffect(async () => {
    const category = currentCategory();

    // Clear cache when switching categories to ensure fresh data
    replayDataCache.clear();

    if (!categoryStores[category]) {
        await initCategoryStore(category);
    }
    setCurrentSelectionStore(categoryStores[category]);
    
    // Clear filters when changing categories
    if (categoryStores[category]) {
        categoryStores[category].setFilters([]);
    }
});
