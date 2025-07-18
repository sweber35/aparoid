import { createOptions, Select } from "@thisbeyond/solid-select";
import { createMemo, createSignal, Show } from "solid-js";
import { Picker } from "~/components/common/Picker";
import { StageBadge, PlayerBadge } from "~/components/common/Badge";
import { ReplayStub, SelectionStore, currentCategory, setCurrentCategory, initCategoryStore } from "~/state/awsSelectionStore";
import { characterNameByExternalId } from "~/common/ids";
import { API_CONFIG } from "~/config";
import { createEffect } from "solid-js";

interface PlayerInfo {
  tag: string;
  characterId: number;
  playerIndex: number;
}

const categoryOptions = [
    { value: "Ledge Dashes", label: "Ledge Dashes" },
    { value: "Shine Grabs", label: "Shine Grabs" },
];

const stageOptions = [
    { type: "stage", label: "Battlefield" },
    { type: "stage", label: "Dream Land N64" },
    { type: "stage", label: "Final Destination" },
    { type: "stage", label: "Fountain of Dreams" },
    { type: "stage", label: "Pokémon Stadium" },
    { type: "stage", label: "Yoshi's Story" },
];

const categoryFilterProps = createOptions(categoryOptions, {
    key: "label",
});

const stageFilterProps = createOptions(
    [
        ...stageOptions,
    ],
    {
        key: "label",
        createable: (input: any) => ({
            type: "codeOrName", 
            label: input,
        }),
    }
);

export function Replays(props: { selectionStore: SelectionStore }) {
    
    // Create a computed value for the current selected category option
    const currentCategoryOption = createMemo(() => {
        const current = currentCategory();
        return categoryOptions.find(opt => opt.value === current) || categoryOptions[0];
    });
    
    // Sort stubs so bugged stubs are at the bottom
    const sortedFilteredStubs = createMemo(() => {
        return [...props.selectionStore?.data.filteredStubs].sort((a, b) => {
            // undefined bugged treated as false (not bugged)
            return (a.bugged ? 1 : 0) - (b.bugged ? 1 : 0);
        });
    });
    
    const [loadingStubKey, setLoadingStubKey] = createSignal<string | null>(null);
    const [loadingCategory, setLoadingCategory] = createSignal(false);

    // Handle category change with loading state
    async function handleCategoryChange(selected: { value: string; label: string } | null) {
        if (selected && typeof selected === 'object' && 'value' in selected) {
            setLoadingCategory(true);
            try {
                await initCategoryStore(selected.value as import("~/state/awsSelectionStore").Category);
                setCurrentCategory(selected.value as import("~/state/awsSelectionStore").Category);
            } finally {
                setLoadingCategory(false);
            }
        }
    }

    // Refresh button handler
    async function handleRefreshCategory() {
        setLoadingCategory(true);
        try {
            await initCategoryStore(currentCategory());
            // setCurrentCategory(currentCategory()); // Not needed, just refresh
        } finally {
            setLoadingCategory(false);
        }
    }

    return (
        <>
          <div class="flex max-h-96 w-full flex-col items-center gap-2 overflow-y-auto sm:h-full md:max-h-screen">
            {/* Category Selection */}
            <div class="w-full">
              <label class="block text-sm font-medium text-gray-700 mb-1">Tech Skill Category</label>
              <div class="flex items-center gap-2">
                <div class="flex-1 relative">
                  <Show when={currentCategory()} keyed>
                    {(category) => {
                      const currentOption = categoryOptions.find(opt => opt.value === category) || categoryOptions[0];
                      return (
                        <>
                          <Select
                            class="w-full rounded border border-slate-600 bg-white"
                            placeholder="Select tech skill category"
                            {...categoryFilterProps}
                            initialValue={currentOption}
                            disabled={loadingCategory()}
                            onChange={handleCategoryChange}
                          />
                        </>
                      );
                    }}
                  </Show>
                </div>
                <button
                  class="ml-2 rounded border border-slate-400 bg-white hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center"
                  title="Refresh category"
                  onClick={handleRefreshCategory}
                  disabled={loadingCategory()}
                  style={{ height: '38px', width: '38px', padding: 0 }}
                >
                  {loadingCategory() ? (
                    <span class="animate-spin inline-block w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5A9 9 0 1112 21v-3m0 0l-2.25 2.25M12 18v3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Stage/Player Filtering */}
            <div
              class="w-full"
              // don't trigger global shortcuts when typing in the filter box
              onkeydown={(e: Event) => e.stopPropagation()}
              onkeyup={(e: Event) => e.stopPropagation()}
            >
              <label class="block text-sm font-medium text-gray-700 mb-1">Filter by Stage or Player</label>
              <Select
                class="w-full rounded border border-slate-600 bg-white"
                placeholder="Filter by stage or player name"
                multiple
                {...stageFilterProps}
                onChange={props.selectionStore.setFilters}
              />
            </div>

            <Show
              when={() => sortedFilteredStubs().length > 0}
              fallback={<div>No matching results</div>}
            >
              <Picker
                items={sortedFilteredStubs()}
                render={(stub) => (
                  <GameInfo
                    replayStub={stub}
                    loading={
                      loadingStubKey() === `${stub.matchId}-${stub.frameStart}-${stub.frameEnd}`
                    }
                  />
                )}
                onClick={async (fileAndSettings, idx) => {
                  const stub = sortedFilteredStubs()[idx];
                  const key = `${stub.matchId}-${stub.frameStart}-${stub.frameEnd}`;
                  setLoadingStubKey(key);
                  await props.selectionStore.select(fileAndSettings);
                  setLoadingStubKey(null);
                }}
                selected={(stub) =>
                  props.selectionStore.data?.selectedFileAndStub?.[1] === stub
                }
                estimateSize={(stub) => 140}
              />
            </Show>
          </div>
        </>
    );
}

function GameInfo(props: { replayStub: ReplayStub, loading?: boolean }) {
  const [bugged, setBugged] = createSignal(props.replayStub.bugged ?? false);
  const [loading, setLoading] = createSignal(false);

  // Parse the players string to extract player tags and character IDs
  const parsePlayers = () => {
    try {
      // Parse the players JSON string into an array of player objects
      const playersArray = JSON.parse(props.replayStub.players) as PlayerInfo[];
      
      return playersArray.map((player) => ({
        tag: player.tag,
        characterId: player.characterId,
        playerIndex: player.playerIndex + 1 // Convert to 1-based for badges
      }));
    } catch (error) {
      console.error('Error parsing players:', error);
      return [];
    }
  };

  const players = parsePlayers();
  
  // Handler for toggling bugged state
  async function toggleBugged() {
    const newBugged = !bugged();
    setLoading(true);
    setBugged(newBugged); // Optimistic update
    
    const requestBody = {
      matchId: props.replayStub.matchId,
      frameStart: props.replayStub.frameStart,
      frameEnd: props.replayStub.frameEnd,
      bugged: newBugged,
    };
    
    try {
      const response = await fetch(API_CONFIG.replayTag, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      // Use the returned bugged value from the Lambda response
      setBugged(result.bugged);
      // Update the stub's bugged value
      props.replayStub.bugged = result.bugged;
    } catch (e) {
      console.error('Error toggling bugged status:', e);
      setBugged(!newBugged); // Revert on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class={`h-32 p-3 pb-8 border-b border-gray-200 hover:bg-gray-50 mb-1 ${bugged() ? 'bg-yellow-100' : ''}`}>
      {/* Header with stage and date */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <StageBadge stageId={props.replayStub.stageId} />
          <div class="text-sm text-gray-600">
            {new Date(props.replayStub.matchId).toLocaleDateString()}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-xs text-gray-500">
            Frames {props.replayStub.frameStart}-{props.replayStub.frameEnd}
          </div>
          {/* Bugged toggle button */}
          <button
            class={`ml-2 p-1 rounded text-lg ${bugged() ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'} ${loading() ? 'opacity-50' : ''}`}
            title={bugged() ? 'Mark as not bugged' : 'Mark as bugged'}
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              toggleBugged();
            }}
            disabled={loading()}
          >
            {bugged() ? '🐞' : '🪲'}
          </button>
          {/* Loading spinner for replay fetch */}
          <Show when={props.loading}>
            <span class="ml-2 animate-spin inline-block w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"></span>
          </Show>
        </div>
      </div>
      
      {/* Player information */}
      <div class="space-y-1">
        <div class="text-xs font-medium text-gray-700">Players:</div>
        {players.map((player) => (
          <div class="flex items-center gap-2 text-xs text-gray-600 pl-2">
            <PlayerBadge port={player.playerIndex} />
            <span class="font-medium">{player.tag}</span>
            <span class="text-gray-500">
              ({characterNameByExternalId[player.characterId] || `Character ${player.characterId}`})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
