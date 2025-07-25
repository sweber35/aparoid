import createRAF, { targetFPS } from "@solid-primitives/raf";
import {batch, createEffect, createResource, on} from "solid-js";
import { createStore } from "solid-js/store";
import {
    ActionName,
    actionNameById,
    AttackName,
    characterNameByExternalId,
    characterNameByInternalId,
} from "~/common/ids";
import { queries } from "~/search/queries";
import { currentSelectionStore } from "~/state/awsSelectionStore";
import { CharacterAnimations, fetchAnimations } from "~/viewer/animationCache";
import { PlayerInputs, PlayerSettings, PlayerState, PlayerUpdate, PlayerUpdateWithNana, ReplayData } from "~/common/types";
import { Character } from "~/viewer/characters/character";
import { getPlayerOnFrame, getStartOfAction } from "~/viewer/viewerUtil";
import { actionMapByInternalId } from "~/viewer/characters";
import colors from "tailwindcss/colors";
import { themeStore } from "~/state/themeStore";
import {Highlight} from "~/search/search";

interface RenderData {
    playerState: PlayerState;
    playerInputs: PlayerInputs;
    playerSettings: PlayerSettings;
  
    // main render
    path?: string;
    innerColor: string;
    outerColor: string;
    transforms: string[];
  
    // shield/shine renders
    animationName: string;
    characterData: Character;
  }
  
export interface ReplayStore {
    replayData?: ReplayData;
    highlights: Record<string, Highlight[]>;
    selectedHighlight?: [string, Highlight];
    animations: (CharacterAnimations | undefined)[];
    frame: number;
    renderDatas: RenderData[];
    fps: number;
    framesPerTick: number;
    running: boolean;
    zoom: number;
    isDebug: boolean;
    isFullscreen: boolean;
    customAction: ActionName;
    customAttack: AttackName;
  }

const defaultReplayStoreState: ReplayStore = {
    highlights: Object.fromEntries(
        Object.entries(queries).map(([name]) => [name, []])
    ),
    frame: 0,
    renderDatas: [],
    animations: Array(4).fill(undefined),
    fps: 60,
    framesPerTick: 1,
    running: false,
    zoom: 1,
    isDebug: false,
    isFullscreen: false,
    customAction: "Wait",
    customAttack: "None",
};

const [replayState, setReplayState] = createStore<ReplayStore>(
    defaultReplayStoreState
);

export const replayStore = replayState;

export function speedNormal(): void {
    batch(() => {
        setReplayState("fps", 60);
        setReplayState("framesPerTick", 1);
    });
}

export function speedFast(): void {
    setReplayState("framesPerTick", 2);
}

export function speedSlow(): void {
    setReplayState("fps", 30);
}

export function zoomIn(): void {
    setReplayState("zoom", (z) => z * 1.01);
}

export function zoomOut(): void {
    setReplayState("zoom", (z) => z / 1.01);
}

export function toggleDebug(): void {
    setReplayState("isDebug", (isDebug) => !isDebug);
}

export function toggleFullscreen(): void {
    setReplayState("isFullscreen", (isFullscreen) => !isFullscreen);
}

export function togglePause(): void {
    running() ? stop() : start();
}

export function pause(): void {
    stop();
}

export function jump(target: number): void {
    setReplayState("frame", wrapFrame(replayState, target));
}

// percent is [0,1]
export function jumpPercent(percent: number): void {
    setReplayState(
        "frame",
        Math.round((replayState.replayData?.frames.length ?? 0) * percent)
    );
}

export function adjust(delta: number): void {
    setReplayState("frame", (f) => wrapFrame(replayState, f + delta));
}

export function loadReplayData(replayData: ReplayData): void {
    setReplayState("replayData", replayData);
    setReplayState("renderDatas", []);
    setReplayState("frame", 0);
    start();
}

const [running, start, stop] = createRAF(
    targetFPS(
        () =>
            setReplayState("frame", (f) =>
                wrapFrame(replayState, f + replayState.framesPerTick)
            ),
        () => replayState.fps
    )
);
createEffect(() => setReplayState("running", running()));

createEffect(
    on(
        () => currentSelectionStore()?.data.selectedFileAndStub?.[0],
        (selectedData) => {
            if (!selectedData) {
                return;
            }

            setReplayState("replayData", selectedData);
            setReplayState("renderDatas", []);
            setReplayState("frame", 0);

            start();
        }
    )
);

createEffect(() => {
    const store = currentSelectionStore();
    const firstStub = store?.data.stubs?.[0];
    if (!store || !firstStub) return;

    // Only auto-select if there's no current selection
    if (!store.data.selectedFileAndStub) {
        store.select(firstStub);
    }
});

const animationResources = [];
for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
    animationResources.push(
        createResource(
            () => {
                const replay = replayState.replayData;
                if (replay === undefined) {
                    return undefined;
                }
                const playerSettings = replay.settings.playerSettings[playerIndex];
                if (playerSettings === undefined) {
                    return undefined;
                }
                const playerUpdate =
                    replay.frames[replayState.frame].players[playerIndex];
                if (playerUpdate === undefined) {
                    return playerSettings.externalCharacterId;
                }
                if (
                    playerUpdate.state.internalCharacterId ===
                    characterNameByInternalId.indexOf("Zelda")
                ) {
                    return characterNameByExternalId.indexOf("Zelda");
                }
                if (
                    playerUpdate.state.internalCharacterId ===
                    characterNameByInternalId.indexOf("Sheik")
                ) {
                    return characterNameByExternalId.indexOf("Sheik");
                }
                return playerSettings.externalCharacterId;
            },
            (id) => (id === undefined ? undefined : fetchAnimations(id))
        )
    );
}
animationResources.forEach(([dataSignal], playerIndex) =>
    createEffect(() =>
        // I can't use the obvious setReplayState("animations", playerIndex,
        // dataSignal()) because it will merge into the previous animations data
        // object, essentially overwriting the previous characters animation data
        // forever
        setReplayState("animations", (animations) => {
            const newAnimations = [...animations];
            newAnimations[playerIndex] = dataSignal();
            return newAnimations;
        })
    )
);

createEffect(() => {
    if (replayState.replayData === undefined) {
        return;
    }

    setReplayState(
        "renderDatas",
        replayState.replayData.frames[replayState.frame].players
            .filter((playerUpdate) => playerUpdate)
            .sort((a, b) => a.playerIndex - b.playerIndex)
            .flatMap((playerUpdate) => {
                const animations = replayState.animations[playerUpdate.playerIndex];
                if (animations === undefined) return [];
                const renderDatas = [];
                renderDatas.push(
                    computeRenderData(replayState, playerUpdate, animations, false)
                );
                if (playerUpdate.nanaState != null) {
                    renderDatas.push(
                        computeRenderData(replayState, playerUpdate, animations, true)
                    );
                }
                return renderDatas;
            })
    );
});


export function computeRenderData(
    replayState: ReplayStore,
    playerUpdate: PlayerUpdate,
    animations: CharacterAnimations,
    isNana: boolean
  ): RenderData {
    const playerState = (playerUpdate as PlayerUpdateWithNana)[isNana ? "nanaState" : "state"];
    const playerInputs = (playerUpdate as PlayerUpdateWithNana)[isNana ? "nanaInputs" : "inputs"];
    
    // Safety check: ensure playerInputs exists
    if (!playerInputs || !playerInputs.processed) {
        console.warn('Player inputs missing for player', playerUpdate.playerIndex);
        // Return a minimal render data to prevent crashes
        return {
            playerState,
            playerInputs: {
                frameNumber: playerUpdate.frameNumber,
                playerIndex: playerUpdate.playerIndex,
                isNana,
                physical: {
                    a: false, b: false, x: false, y: false, z: false, start: false,
                    dPadLeft: false, dPadRight: false, dPadDown: false, dPadUp: false,
                    rTriggerAnalog: 0, rTriggerDigital: false, lTriggerAnalog: 0, lTriggerDigital: false
                },
                processed: {
                    a: false, b: false, x: false, y: false, z: false, start: false,
                    dPadLeft: false, dPadRight: false, dPadDown: false, dPadUp: false,
                    rTriggerDigital: false, lTriggerDigital: false,
                    joystickX: 0, joystickY: 0, cStickX: 0, cStickY: 0, anyTrigger: 0
                }
            },
            playerSettings: replayState.replayData!.settings.playerSettings.find(s => s.playerIndex === playerUpdate.playerIndex) || {
                playerIndex: playerUpdate.playerIndex,
                port: playerUpdate.playerIndex + 1,
                externalCharacterId: 0,
                internalCharacterIds: [0],
                playerType: 0,
                startStocks: 4,
                costumeIndex: 0,
                teamShade: 0,
                handicap: 0,
                teamId: 0,
                staminaMode: false,
                silentCharacter: false,
                lowGravity: false,
                invisible: false,
                blackStockIcon: false,
                metal: false,
                startGameOnWarpPlatform: false,
                rumbleEnabled: true,
                cpuLevel: 0,
                offenseRatio: 1,
                defenseRatio: 1,
                modelScale: 1,
                controllerFix: "None",
                nametag: "",
                displayName: "",
                connectCode: ""
            },
            path: "",
            innerColor: themeStore.isDark() ? "#6000FF" : "blue", // ultraviolet in dark mode
            outerColor: themeStore.isDark() ? "#4A4A4A" : "black", // charred-graphite in dark mode
            transforms: [`translate(${playerState.xPosition} ${playerState.yPosition})`],
            animationName: "Wait",
            characterData: { scale: 1, shieldOffset: [0, 0], shieldSize: 10, animationMap: new Map(), specialsMap: new Map() }
        };
    }
    const playerSettings = replayState
      .replayData!.settings.playerSettings.filter(Boolean)
      .find((settings) => settings.playerIndex === playerUpdate.playerIndex)!;
  
    const startOfActionFrame = getStartOfAction(playerState, replayState.replayData!);
    const startOfActionPlayerUpdate = getPlayerOnFrame(
      playerUpdate.playerIndex,
      startOfActionFrame,
      replayState.replayData!
    );
  
    // If we can't find the start of the action, use the current player state as fallback
    const startOfActionPlayerState: PlayerState = startOfActionPlayerUpdate
      ? (startOfActionPlayerUpdate as PlayerUpdateWithNana)[isNana ? "nanaState" : "state"]
      : playerState;
  
    const actionName = actionNameById[playerState.actionStateId];
    const characterData = actionMapByInternalId[playerState.internalCharacterId];
    const animationName =
        characterData.animationMap.get(actionName) ||
        characterData.specialsMap.get(playerState.actionStateId) ||
        actionName;
  
    const animationFrames = animations[animationName];
    // TODO: validate L cancels, other fractional frames, and one-indexed
    // animations. I am currently just flooring. Converts - 1 to 0 and loops for
    // Entry, Guard, etc.
    const frameIndex =
      Math.floor(Math.max(0, playerState.actionStateFrameCounter)) %
      (animationFrames?.length ?? 1);
    // To save animation file size, duplicate frames just reference earlier
    // matching frames such as "frame20".
    const animationPathOrFrameReference = animationFrames?.[frameIndex];
    const path =
      animationPathOrFrameReference !== undefined &&
      (animationPathOrFrameReference.startsWith("frame") ?? false)
        ? animationFrames?.[
            Number(animationPathOrFrameReference.slice("frame".length))
          ]
        : animationPathOrFrameReference;
    const rotation =
      animationName === "DamageFlyRoll"
        ? getDamageFlyRollRotation(replayState, playerState)
        : isSpacieUpB(playerState)
        ? getSpacieUpBRotation(replayState, playerState)
        : 0;
    // Some animations naturally turn the player around, but facingDirection
    // updates partway through the animation and incorrectly flips the
    // animation. The solution is to "fix" the facingDirection for the duration
    // of the action, as the animation expects. However upB turnarounds and
    // Jigglypuff/Kirby mid-air jumps are an exception where we need to flip
    // based on the updated state.facingDirection.
    const facingDirection = actionFollowsFacingDirection(animationName)
      ? playerState.facingDirection
      : startOfActionPlayerState.facingDirection;
    return {
      playerState,
      playerInputs,
      playerSettings,
      path,
      innerColor: getPlayerColor(
        replayState,
        playerUpdate.playerIndex,
        playerState.isNana
      ),
      outerColor:
        startOfActionPlayerState.lCancelStatus === "missed"
          ? (themeStore.isDark() ? "#D000FF" : "red") // venom-magenta in dark mode
          : playerState.hurtboxCollisionState !== "vulnerable"
          ? (themeStore.isDark() ? "#B7C0EE" : "blue") // ultraviolet in dark mode
          : (themeStore.isDark() ? "#4A4A4A" : "black"), // charred-graphite in dark mode
      transforms: [
        `translate(${playerState.xPosition} ${playerState.yPosition})`,
        // TODO: rotate around true character center instead of current guessed
        // center of position+(0,8)
        `rotate(${rotation} 0 8)`,
        `scale(${characterData.scale} ${characterData.scale})`,
        `scale(${facingDirection} 1)`,
        "scale(.1 -.1) translate(-500 -500)",
      ],
      animationName,
      characterData,
    };
  }
  
  // DamageFlyRoll default rotation is (0,1), but we calculate rotation from (1,0)
  // so we need to subtract 90 degrees. Quick checks:
  // 0 - 90 = -90 which turns (0,1) into (1,0)
  // -90 - 90 = -180 which turns (0,1) into (-1,0)
  // Facing direction is handled naturally because the rotation will go the
  // opposite direction (that scale happens first) and the flip of (0,1) is still
  // (0, 1)
  function getDamageFlyRollRotation(
    replayState: ReplayStore,
    playerState: PlayerState
  ): number {
    const previousPlayerUpdate = getPlayerOnFrame(
      playerState.playerIndex,
      playerState.frameNumber - 1,
      replayState.replayData!
    );
  
    // If previous frame doesn't exist, return 0 rotation (no rotation)
    if (!previousPlayerUpdate) {
      return 0;
    }
  
    const previousState = (previousPlayerUpdate as PlayerUpdateWithNana)[
      playerState.isNana ? "nanaState" : "state"
    ];
    
    const deltaX = playerState.xPosition - previousState.xPosition;
    const deltaY = playerState.yPosition - previousState.yPosition;
  
    return (Math.atan2(deltaY, deltaX) * 180) / Math.PI - 90;
  }
  
  // Rotation will be whatever direction the player was holding at blastoff. The
  // default rotation of the animation is (1,0), so we need to subtract 180 when
  // facing left, and subtract 0 when facing right.
  // Quick checks:
  // 0 - 0 = 0, so (1,0) is unaltered when facing right
  // 0 - 180 = -180, so (1,0) is flipped when facing left
  function getSpacieUpBRotation(
    replayState: ReplayStore,
    playerState: PlayerState
  ): number {
    const startOfActionPlayer = getPlayerOnFrame(
      playerState.playerIndex,
      getStartOfAction(playerState, replayState.replayData!),
      replayState.replayData!
    );
    
    // If start of action player doesn't exist, return 0 rotation (no rotation)
    if (!startOfActionPlayer) {
      return 0;
    }
    
    const joystickDegrees =
      ((startOfActionPlayer.inputs.processed.joystickY === 0 &&
      startOfActionPlayer.inputs.processed.joystickX === 0
        ? Math.PI / 2
        : Math.atan2(
            startOfActionPlayer.inputs.processed.joystickY,
            startOfActionPlayer.inputs.processed.joystickX
          )) *
        180) /
      Math.PI;
    return (
      joystickDegrees -
      ((startOfActionPlayer as PlayerUpdateWithNana)[
        playerState.isNana ? "nanaState" : "state"
      ].facingDirection === -1
        ? 180
        : 0)
    );
  }
  
  // All jumps and upBs either 1) Need to follow the current frame's
  // facingDirection, or 2) Won't have facingDirection change during the action.
  // In either case we can grab the facingDirection from the current frame.
  function actionFollowsFacingDirection(animationName: string): boolean {
    return (
      animationName.includes("Jump") ||
      ["SpecialHi", "SpecialAirHi"].includes(animationName)
    );
  }
  
  function isSpacieUpB(playerState: PlayerState): boolean {
    const character = characterNameByInternalId[playerState.internalCharacterId];
    return (
      ["Fox", "Falco"].includes(character) &&
      [355, 356].includes(playerState.actionStateId)
    );
  }
  
  export function getPlayerColor(
    replayState: ReplayStore,
    playerIndex: number,
    isNana: boolean
  ): string {
    // Use high-contrast dark theme colors when in dark mode
    if (themeStore.isDark()) {
      if (replayState.replayData!.settings.isTeams) {
        const settings =
          replayState.replayData!.settings.playerSettings[playerIndex];
        return [
          ["#D000FF", "#BB00E5"], // venom-magenta for red team
          ["#00E887", "#00D179"], // ecto-green for green team  
          ["#6000FF", "#5500E5"], // ultraviolet for blue team
        ][settings.teamId][isNana ? 1 : settings.teamShade];
      }
      return [
        ["#00E887", "#00D179"], // Player 1: ecto-green
        ["#D000FF", "#BB00E5"], // Player 2: venom-magenta
        ["#6000FF", "#5500E5"], // Player 3: ultraviolet
        ["#4A4A4A", "#424242"], // Player 4: charred-graphite
      ][playerIndex][isNana ? 1 : 0];
    }

    // Original light mode colors
    if (replayState.replayData!.settings.isTeams) {
      const settings =
        replayState.replayData!.settings.playerSettings[playerIndex];
      return [
        [colors.red["800"], colors.red["600"]],
        [colors.green["800"], colors.green["600"]],
        [colors.blue["800"], colors.blue["600"]],
      ][settings.teamId][isNana ? 1 : settings.teamShade];
    }
    return [
      [colors.red["700"], colors.red["600"]],
      [colors.blue["700"], colors.blue["600"]],
      [colors.yellow["500"], colors.yellow["400"]],
      [colors.green["700"], colors.green["600"]],
    ][playerIndex][isNana ? 1 : 0];
  }
  
  export function wrapFrame(replayState: ReplayStore, frame: number): number {
    if (!replayState.replayData) return frame;
    return (
      (frame + replayState.replayData.frames.length) %
      replayState.replayData.frames.length
    );
  }
  
  function wrapHighlight(replayState: ReplayStore, highlight: number): number {
    const length = Object.entries(replayState.highlights).flatMap(
      ([name, highlights]) => highlights
    ).length;
    return (highlight + length) % length;
  }
