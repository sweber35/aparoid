import { createMemo, For, Show, createSignal, onMount } from "solid-js";
import { replayStore } from "~/state/awsStore";
import { characterNameByExternalId, itemNamesById } from "~/common/ids";
import { getPlayerOnFrame, getStartOfAction } from "~/viewer/viewerUtil";

// Toggle this to enable/disable the debug panel
const DEBUG_PANEL_ENABLED = false;

export function DebugPanel() {
  if (!DEBUG_PANEL_ENABLED) return null;

  const renderDatas = createMemo(() => replayStore.renderDatas);
  const currentFrame = createMemo(() => replayStore.frame);
  const replayData = createMemo(() => replayStore.replayData);

  // Track player order changes
  const [playerOrderHistory, setPlayerOrderHistory] = createSignal<Array<{
    frame: number;
    players: Array<{
      index: number;
      port: number;
      character: string;
      facingDirection: number;
    }>;
  }>>([]);

  // Update history when frame changes
  createMemo(() => {
    const frame = currentFrame();
    const datas = renderDatas();
    
    if (datas.length > 0) {
      const currentOrder = datas.map(rd => ({
        index: rd.playerInputs.playerIndex,
        port: rd.playerSettings.port,
        character: characterNameByExternalId[rd.playerSettings.externalCharacterId],
        facingDirection: rd.playerState.facingDirection
      }));

      setPlayerOrderHistory(prev => {
        const newHistory = [...prev];
        // Only add if order changed or it's a new frame
        const lastEntry = newHistory[newHistory.length - 1];
        if (!lastEntry || 
            lastEntry.frame !== frame ||
            JSON.stringify(lastEntry.players) !== JSON.stringify(currentOrder)) {
          newHistory.push({
            frame,
            players: currentOrder
          });
          // Keep only last 10 entries
          if (newHistory.length > 10) {
            newHistory.shift();
          }
        }
        return newHistory;
      });
    }
  });

  const [showPlayerOrderHistory, setShowPlayerOrderHistory] = createSignal(false);

  return (
    <Show when={replayData()}>
      <div
        class="fixed left-0 right-0 bottom-0 w-full bg-black/90 text-white p-3 z-50 border-t border-gray-700"
        style="min-height: 220px; max-height: 50vh; overflow-y: auto;"
      >
        <div class="flex items-end justify-between mb-2">
          <div class="text-sm font-bold text-yellow-400">Debug Panel</div>
          <div class="flex items-center gap-2">
            <button
              onClick={() => setShowPlayerOrderHistory(!showPlayerOrderHistory())}
              class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
            >
              {showPlayerOrderHistory() ? "Hide" : "Show"} Player Order History
            </button>
            <span class="text-gray-300">Frame: {currentFrame()}</span>
          </div>
        </div>

        <Show when={showPlayerOrderHistory()}>
          <div class="mb-2">
            <div class="font-semibold mb-1">Player Order History</div>
            <div class="text-xs text-gray-300 max-h-24 overflow-y-auto">
              <For each={playerOrderHistory()}>
                {(entry) => (
                  <div class="mb-1">
                    Frame {entry.frame}: {entry.players.map(p => p.character).join(", ")}
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Item information section */}
        <div class="mb-2">
          <div class="font-semibold mb-1 text-blue-300">Items on Frame</div>
          <div class="text-xs text-gray-300 max-h-32 overflow-y-auto">
            <Show when={(() => {
              const frame = replayStore.frame;
              const items = replayStore.replayData?.frames?.[frame]?.items;
              return items && items.length > 0;
            })()} fallback={<div>No items on this frame.</div>}>
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="border-b border-gray-600">
                    <th class="pr-2 text-left">#</th>
                    <th class="pr-2 text-left">Name</th>
                    <th class="pr-2 text-left">typeId</th>
                    <th class="pr-2 text-left">state</th>
                    <th class="pr-2 text-left">X</th>
                    <th class="pr-2 text-left">Y</th>
                    <th class="pr-2 text-left">dX</th>
                    <th class="pr-2 text-left">dY</th>
                    <th class="pr-2 text-left">Facing</th>
                    <th class="pr-2 text-left">Owner</th>
                    <th class="pr-2 text-left">Special</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={replayStore.replayData?.frames?.[replayStore.frame]?.items || []}>
                    {(item, i) => (
                      <tr class="border-b border-gray-700 hover:bg-gray-800">
                        <td class="pr-2">{i() + 1}</td>
                        <td class="pr-2">{itemNamesById[item.typeId] || `Type ${item.typeId}`}</td>
                        <td class="pr-2">{item.typeId}</td>
                        <td class="pr-2">{item.state}</td>
                        <td class="pr-2">{item.xPosition.toFixed(2)}</td>
                        <td class="pr-2">{item.yPosition.toFixed(2)}</td>
                        <td class="pr-2">{item.xVelocity.toFixed(2)}</td>
                        <td class="pr-2">{item.yVelocity.toFixed(2)}</td>
                        <td class="pr-2">{item.facingDirection}</td>
                        <td class="pr-2">{item.owner !== -1 ? item.owner : "-"}</td>
                        <td class="pr-2">
                          <Show when={item.samusMissileType !== undefined && item.samusMissileType !== 0}>
                            <span>missileType:{item.samusMissileType} </span>
                          </Show>
                          <Show when={item.peachTurnipFace !== undefined && item.peachTurnipFace !== 0}>
                            <span>turnipFace:{item.peachTurnipFace} </span>
                          </Show>
                          <Show when={item.chargeShotChargeLevel !== undefined && item.chargeShotChargeLevel !== 0}>
                            <span>charge:{item.chargeShotChargeLevel} </span>
                          </Show>
                          <Show when={item.isChargeShotLaunched !== undefined && item.isChargeShotLaunched}>
                            <span>launched </span>
                          </Show>
                          <Show when={item.damageTaken !== undefined && item.damageTaken !== 0}>
                            <span>dmg:{item.damageTaken} </span>
                          </Show>
                          <Show when={item.expirationTimer !== undefined && item.expirationTimer !== 0}>
                            <span>expire:{item.expirationTimer.toFixed(1)} </span>
                          </Show>
                          <Show when={item.spawnId !== undefined && item.spawnId !== 0}>
                            <span>spawnId:{item.spawnId}</span>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
        </div>

        {/* Player debug panels side by side */}
        <div class="flex flex-row gap-4 w-full">
          <For each={renderDatas()}>
            {(renderData) => {
              const [showAdvanced, setShowAdvanced] = createSignal(false);
              const relativeFrame = replayStore.frame;
              if (!replayStore.replayData) return null;
              const absoluteFrame = replayStore.replayData.frames[relativeFrame]?.frameNumber;
              const playerIndex = renderData.playerSettings.playerIndex;
              if (absoluteFrame === undefined) {
                return (
                  <div class="flex-1 min-w-0 p-2 border border-gray-600 rounded bg-gray-900/80">
                    <div class="font-bold text-blue-400 mb-1">
                      Player {renderData.playerInputs.playerIndex + 1} (Port {renderData.playerSettings.port})
                    </div>
                    <div class="text-red-400">No absolute frame for relative frame {relativeFrame}</div>
                  </div>
                );
              }
              const currentFramePlayerUpdate = getPlayerOnFrame(
                playerIndex,
                absoluteFrame,
                replayStore.replayData!
              );
              const playerState = renderData.playerState;
              if (!currentFramePlayerUpdate || !currentFramePlayerUpdate.state) {
                return (
                  <div class="flex-1 min-w-0 p-2 border border-gray-600 rounded bg-gray-900/80">
                    <div class="font-bold text-blue-400 mb-1">
                      Player {renderData.playerInputs.playerIndex + 1} (Port {renderData.playerSettings.port})
                    </div>
                    <div class="text-red-400">No player {playerIndex} data at absolute frame {absoluteFrame}</div>
                  </div>
                );
              }
              const startOfActionFrame = getStartOfAction(playerState, replayStore.replayData!);
              const startOfActionPlayerUpdate = getPlayerOnFrame(
                playerIndex,
                startOfActionFrame,
                replayStore.replayData!
              );

              return (
                <div class="flex-1 min-w-0 p-2 border border-gray-600 rounded bg-gray-900/80 mr-2">
                  <div class="font-bold text-blue-400 mb-1">
                    Player {renderData.playerInputs.playerIndex + 1} (Port {renderData.playerSettings.port})
                  </div>
                  <div class="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div class="text-gray-400">Character:</div>
                      <div>{characterNameByExternalId[renderData.playerSettings.externalCharacterId]}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Facing Direction:</div>
                      <div class={playerState.facingDirection > 0 ? "text-green-400" : "text-red-400"}>
                        Raw: {playerState.facingDirection > 0 ? "Right (+1)" : "Left (-1)"}
                      </div>
                      <div class="text-xs text-gray-500">
                        Used in transforms: {(() => {
                          const facingTransform = renderData.transforms.find(t => t.includes('scale(') && t.includes(' 1)'));
                          return facingTransform?.includes('-1') ? 'Left (-1)' : 'Right (+1)';
                        })()}
                      </div>
                      <div class="text-xs text-gray-500">
                        Action: {renderData.animationName}
                      </div>
                      <div class="text-xs text-gray-500">
                        Follows current: {(() => {
                          const actionName = renderData.animationName;
                          return (actionName.includes("Jump") || ["SpecialHi", "SpecialAirHi"].includes(actionName)) ? "Yes" : "No";
                        })()}
                      </div>
                    </div>
                    <div>
                      <div class="text-gray-400">Position:</div>
                      <div>X: {playerState.xPosition.toFixed(2)}</div>
                      <div>Y: {playerState.yPosition.toFixed(2)}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Action State:</div>
                      <div>{renderData.animationName}</div>
                      <div class="text-xs text-gray-500">ID: {playerState.actionStateId}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Action Frame:</div>
                      <div>{playerState.actionStateFrameCounter.toFixed(2)}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Stocks:</div>
                      <div>{playerState.stocksRemaining}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Percent:</div>
                      <div>{Math.floor(playerState.percent)}%</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Hitstun:</div>
                      <div class={playerState.isInHitstun ? "text-red-400" : "text-gray-400"}>{playerState.isInHitstun ? "Yes" : "No"}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Hitlag:</div>
                      <div class={playerState.hitlagRemaining > 0 ? "text-yellow-400" : "text-gray-400"}>{playerState.hitlagRemaining}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Hurtbox State:</div>
                      <div class="capitalize">{playerState.hurtboxCollisionState}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Shield Size:</div>
                      <div>{renderData.characterData.shieldSize.toFixed(2)}</div>
                    </div>
                    <div>
                      <div class="text-gray-400">Shield Offset:</div>
                      <div>X: {renderData.characterData.shieldOffset[0].toFixed(2)}</div>
                      <div>Y: {renderData.characterData.shieldOffset[1].toFixed(2)}</div>
                    </div>
                  </div>
                  <div class="mt-2 pt-2 border-t border-gray-600">
                    <div class="text-gray-400 mb-1">Inputs:</div>
                    <div class="grid grid-cols-2 gap-1 text-xs">
                      <div>Joystick: ({renderData.playerInputs.processed.joystickX.toFixed(2)}, {renderData.playerInputs.processed.joystickY.toFixed(2)})</div>
                      <div>C-Stick: ({renderData.playerInputs.processed.cStickX.toFixed(2)}, {renderData.playerInputs.processed.cStickY.toFixed(2)})</div>
                      <div>A: {renderData.playerInputs.processed.a ? "✓" : "✗"}</div>
                      <div>B: {renderData.playerInputs.processed.b ? "✓" : "✗"}</div>
                      <div>X: {renderData.playerInputs.processed.x ? "✓" : "✗"}</div>
                      <div>Y: {renderData.playerInputs.processed.y ? "✓" : "✗"}</div>
                      <div>Z: {renderData.playerInputs.processed.z ? "✓" : "✗"}</div>
                      <div>L: {renderData.playerInputs.processed.lTriggerDigital ? "✓" : "✗"}</div>
                      <div>R: {renderData.playerInputs.processed.rTriggerDigital ? "✓" : "✗"}</div>
                      <div>Start: {renderData.playerInputs.processed.start ? "✓" : "✗"}</div>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
} 