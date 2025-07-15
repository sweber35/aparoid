import { createStore } from "solid-js/store";
import { createEffect, createSignal, on } from "solid-js";
import { ReplayData, Frame } from "~/common/types";
import { stageNameByExternalId, ExternalStageName } from "~/common/ids";
import { LAMBDA_URLS } from "~/config";

export type ActionState = 'CLIFF_WAIT' | 'FALL' | 'JUMP' |
                          'AIR_DODGE' | 'IDLE' | 'SHINE_START' |
                          'SHINE_WAIT' | 'JUMP_SQUAT' | 'GRAB';

export type Category = 'Ledge Dashes' | 'Shine Grabs';

// Mapping from categories to action state sequences
export const categoryToActionSequence: Record<Category, {action: ActionState, minFrames?: number, maxFrames?: number}[]> = {
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
};

export type Filter = 
  | { type: "stage"; label: ExternalStageName }
  | { type: "codeOrName"; label: string };

export async function loadStubsForActionSequence(actionSequence: {action: ActionState, minFrames?: number, maxFrames?: number}[]): Promise<ReplayStub[]> {
    const res = await fetch(LAMBDA_URLS.REPLAY_STUBS_LAMBDA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: actionSequence }),
    });

    const payload = await res.json();

    return payload;
}

export async function loadStubsForCategory(category: Category): Promise<ReplayStub[]> {
    const actionSequence = categoryToActionSequence[category];
    return loadStubsForActionSequence(actionSequence);
}

export interface SelectionState {
    filter?: Category;
    filters: Filter[];
    stubs: ReplayStub[];
    filteredStubs: ReplayStub[];
    selectedFileAndStub?: [ReplayData, ReplayStub];
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
        const data = await stubStore.getReplayData(stub);
        setSelectionState("selectedFileAndStub", [data, stub]);
    }

    createEffect(() => {
        setSelectionState("stubs", stubStore.stubs());
        console.log("Updated selectionState.stubs:", stubStore.stubs());
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
            const stagePass = stagesAllowed.length === 0 || 
                stagesAllowed.includes(stageNameByExternalId[stub.stageId]);

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

    return { data: selectionState, setFilter, setFilters, select };
}

const categoryStores: Record<string, SelectionStore> = {};

// Cache for replay data to prevent unnecessary refetching
const replayDataCache = new Map<string, ReplayData>();

export async function initCategoryStore(category: Category) {
    console.log('Loading stubs for category:', category);
    const stubs = await loadStubsForCategory(category);
    console.log('Loaded stubs:', stubs.length, 'for category:', category);

    const [stubSignal, setStubSignal] = createSignal<ReplayStub[]>(stubs);
    console.log("Loaded stubs:", stubs);

    categoryStores[category] = createSelectionStore({
        stubs: stubSignal,
        async getReplayData(stub): Promise<ReplayData> {
            // Create a cache key based on the stub's unique properties
            const cacheKey = `${stub.matchId}-${stub.frameStart}-${stub.frameEnd}`;
            
            // Check if we already have this replay data cached
            if (replayDataCache.has(cacheKey)) {
                console.log('Using cached replay data for:', cacheKey);
                return replayDataCache.get(cacheKey)!;
            }

            console.log('Fetching replay data for:', cacheKey);
            const result = await fetch(LAMBDA_URLS.REPLAY_DATA_LAMBDA, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stub),
            });

            if (!result.ok) {
                throw new Error(`Lambda fetch failed: ${result.statusText}`);
            }

            const data = await result.json();

            const replayData: ReplayData = {
                ...data,
                frameIndexByNumber: Object.fromEntries(
                    data.frames.map((frame: Frame, index: number) => [frame.frameNumber, index])
                )
            };

            for (let i = 1; i < replayData.frames.length; i++) {
                const prev = replayData.frames[i - 1].frameNumber;
                const curr = replayData.frames[i].frameNumber;
                if (curr !== prev + 1) {
                    console.warn(`Frame gap between ${prev} and ${curr}`);
                }
            }
            console.log('Loaded replay data:', replayData);

            // Cache the replay data
            replayDataCache.set(cacheKey, replayData);

            return replayData;
        },
    });
    console.log('Category store created for:', category);
}

export const [currentCategory, setCurrentCategory] = createSignal<Category>("Ledge Dashes");
export const [currentSelectionStore, setCurrentSelectionStore] = createSignal<SelectionStore | undefined>(undefined);

// Initialize the first category store immediately
(async () => {
    console.log('Initializing first category store');
    await initCategoryStore("Ledge Dashes");
    setCurrentSelectionStore(categoryStores["Ledge Dashes"]);
})();

createEffect(async () => {
    const category = currentCategory();
    console.log('Category changed to:', category);

    // Clear cache when switching categories to ensure fresh data
    replayDataCache.clear();
    console.log('Cleared replay data cache for new category');

    if (!categoryStores[category]) {
        console.log('Initializing category store for:', category);
        await initCategoryStore(category);
    }
    console.log('setCurrentSelectionStore():', category, categoryStores[category]);
    setCurrentSelectionStore(categoryStores[category]);
    
    // Clear filters when changing categories
    if (categoryStores[category]) {
        console.log('Clearing filters for category:', category);
        categoryStores[category].setFilters([]);
    }
});
