import { createOptions, Select } from "@thisbeyond/solid-select";
import { createMemo, createSignal, Show } from "solid-js";
import { Picker } from "~/components/common/Picker";
import { StageBadge, PlayerBadge } from "~/components/common/Badge";
import { ReplayStub, SelectionStore, currentCategory, setCurrentCategory, initCategoryStore } from "~/state/awsSelectionStore";
import { characterNameByExternalId } from "~/common/ids";
import { API_CONFIG } from "~/config";
import { createEffect } from "solid-js";
import { themeStore } from "~/state/themeStore";
import { replayStore } from "~/state/awsStore";

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
          <div class="flex max-h-96 w-full flex-col items-center gap-2 overflow-y-auto pl-4 pr-4 py-4 sm:h-full md:max-h-screen" style={themeStore.isDark() ? { 'border': 'none' } : {}}>
            {/* Category Selection */}
            <div class="w-full">
              <label class="block text-sm font-medium text-theme-primary mb-1">Tech Skill Category</label>
              <div class="flex items-center gap-2">
                <div class="flex-1 relative">
                  <Show when={currentCategory()} keyed>
                    {(category) => {
                      const currentOption = categoryOptions.find(opt => opt.value === category) || categoryOptions[0];
                      return (
                        <>
                          <Select
                            class={`w-full rounded ${
                              themeStore.isDark() 
                                ? 'bg-void-500 text-white' 
                                : 'bg-theme-primary text-theme-primary border border-white'
                            }`}
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
                  class={`ml-2 rounded border disabled:opacity-50 flex items-center justify-center transition-colors duration-200 ${
                    themeStore.isDark() 
                      ? 'bg-void-500 hover:bg-void-400 text-white' 
                      : 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary border-theme-primary'
                  }`}
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
              <label class="block text-sm font-medium text-theme-primary mb-1">Filter by Stage or Player</label>
              <Select
                class={`w-full rounded ${
                  themeStore.isDark() 
                    ? 'bg-void-500 text-white' 
                    : 'bg-theme-primary text-theme-primary border border-white'
                }`}
                placeholder="Filter by stage or player name"
                multiple
                {...stageFilterProps}
                onChange={props.selectionStore.setFilters}
              />
            </div>

            <Show
              when={() => sortedFilteredStubs().length > 0}
              fallback={<div class="text-theme-secondary">No matching results</div>}
            >
              <Picker
                items={sortedFilteredStubs()}
                render={(stub) => (
                  <GameInfo
                    replayStub={stub}
                    loading={
                      props.selectionStore.data.loadingStubKey === `${stub.matchId}-${stub.frameStart}-${stub.frameEnd}`
                    }
                    selected={props.selectionStore.data?.selectedFileAndStub?.[1] === stub}
                  />
                )}
                onClick={async (fileAndSettings, idx) => {
                  await props.selectionStore.select(fileAndSettings);
                }}
                selected={(stub) =>
                  props.selectionStore.data?.selectedFileAndStub?.[1] === stub
                }
                estimateSize={(stub) => 128}
              />
            </Show>
          </div>
        </>
    );
}

function GameInfo(props: { replayStub: ReplayStub, loading?: boolean, selected?: boolean }) {
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
    <div class={`h-32 px-3 py-2 transition-colors duration-200 ${
      !themeStore.isDark() && 'hover:bg-gray-50'
    } ${
      themeStore.isDark() && 'hover:bg-void-400'
    } ${
      bugged() && !themeStore.isDark() ? 'bg-yellow-100' : ''
    }`} style={themeStore.isDark() ? { 'background-image': 'none' } : {}}>
      {/* Header with stage and date */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <StageBadge stageId={props.replayStub.stageId} />
          <div class="text-sm text-theme-secondary">
            {new Date(props.replayStub.matchId).toLocaleDateString()}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Show when={replayStore.isDebug}>
            <div class="text-xs text-theme-muted">
              Frames {props.replayStub.frameStart}-{props.replayStub.frameEnd}
            </div>
          </Show>
                    {/* Bugged toggle button or loading spinner */}
          {props.loading ? (
            <div class="ml-2 p-1 rounded text-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" rx="1" width="10" height="10" fill={themeStore.isDark() ? "#00E887" : "#9CA3AF"}>
                  <animate id="spinner_c7A9" begin="0;spinner_23zP.end" attributeName="x" dur="0.2s" values="1;13" fill="freeze" />
                  <animate id="spinner_Acnw" begin="spinner_ZmWi.end" attributeName="y" dur="0.2s" values="1;13" fill="freeze" />
                  <animate id="spinner_iIcm" begin="spinner_zfQN.end" attributeName="x" dur="0.2s" values="13;1" fill="freeze" />
                  <animate id="spinner_WX4U" begin="spinner_rRAc.end" attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                </rect>
                <rect x="1" y="13" rx="1" width="10" height="10" fill={themeStore.isDark() ? "#00E887" : "#9CA3AF"}>
                  <animate id="spinner_YLx7" begin="spinner_c7A9.end" attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                  <animate id="spinner_vwnJ" begin="spinner_Acnw.end" attributeName="x" dur="0.2s" values="1;13" fill="freeze" />
                  <animate id="spinner_KQuy" begin="spinner_iIcm.end" attributeName="y" dur="0.2s" values="1;13" fill="freeze" />
                  <animate id="spinner_arKy" begin="spinner_WX4U.end" attributeName="x" dur="0.2s" values="13;1" fill="freeze" />
                </rect>
                <rect x="13" y="13" rx="1" width="10" height="10" fill={themeStore.isDark() ? "#00E887" : "#9CA3AF"}>
                  <animate id="spinner_ZmWi" begin="spinner_YLx7.end" attributeName="x" dur="0.2s" values="13;1" fill="freeze" />
                  <animate id="spinner_zfQN" begin="spinner_vwnJ.end" attributeName="y" dur="0.2s" values="13;1" fill="freeze" />
                  <animate id="spinner_rRAc" begin="spinner_KQuy.end" attributeName="x" dur="0.2s" values="1;13" fill="freeze" />
                  <animate id="spinner_23zP" begin="spinner_arKy.end" attributeName="y" dur="0.2s" values="1;13" fill="freeze" />
                </rect>
              </svg>
            </div>
          ) : (
            <button
              class={`ml-2 p-1 rounded text-lg transition-colors duration-200 ${
                bugged() 
                  ? (themeStore.isDark() ? 'bg-venom-magenta-500 text-white' : 'bg-yellow-400 text-black')
                  : (themeStore.isDark() 
                      ? 'bg-charred-graphite-500 text-theme-primary hover:bg-charred-graphite-400' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300')
              }`}
              title={bugged() ? 'Mark as not bugged' : 'Mark as bugged'}
              onClick={(e) => {
                e.stopPropagation(); // Prevent event bubbling
                toggleBugged();
              }}
            >
              {bugged() ? '🐞' : '🪲'}
            </button>
          )}
        </div>
      </div>
      
      {/* Player information */}
      <div class="space-y-1">
        <div class="text-xs font-medium text-theme-primary">Players:</div>
        {players.map((player) => (
          <div class="flex items-center gap-2 text-xs text-theme-secondary pl-2">
            <PlayerBadge port={player.playerIndex} />
            <span class="font-medium">{player.tag}</span>
            <span class="text-theme-muted">
              ({characterNameByExternalId[player.characterId] || `Character ${player.characterId}`})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
