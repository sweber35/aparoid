import {
  PlayerState,
  PlayerUpdate,
  PlayerUpdateWithNana,
  ReplayData,
} from "~/common/types";

export function getStartOfAction(
  playerState: PlayerState,
  replayData: ReplayData
): number {

  const playerUpdate = getPlayerOnFrame(
    playerState.playerIndex,
    playerState.frameNumber,
    replayData
  );

  if (!playerUpdate) {
    console.warn(`Could not find player on frame ${playerState.frameNumber}`);
    return playerState.frameNumber;
  }

  let earliestStateOfAction = (playerUpdate as PlayerUpdateWithNana)[
    playerState.isNana ? "nanaState" : "state"
  ];

  if (!earliestStateOfAction) {
    console.warn(`Could not find player state on frame ${playerState.frameNumber}`);
    return playerState.frameNumber; // Or throw / handle error
  }

  while (earliestStateOfAction.frameNumber > replayData.frames[0].frameNumber) {
    const previousFrameNumber = earliestStateOfAction.frameNumber - 1;

    // Check if the previous frame exists in the replay data
    if (!replayData.frameIndexByNumber || !(previousFrameNumber in replayData.frameIndexByNumber)) {
      console.warn(
          `Aborting backtrack: Frame ${previousFrameNumber} not found in replay (first available: ${replayData.frames[0].frameNumber})`
      );
      return earliestStateOfAction.frameNumber;
    }

    const testEarlierPlayerUpdate = getPlayerOnFrame(
        playerState.playerIndex,
        previousFrameNumber,
        replayData
    );

    if (!testEarlierPlayerUpdate) {
      console.warn(`Could not find player on frame ${previousFrameNumber}`);
      return earliestStateOfAction.frameNumber;
    }

    const testEarlierState = (testEarlierPlayerUpdate as PlayerUpdateWithNana)[
      playerState.isNana ? "nanaState" : "state"
    ];

    if (
        !testEarlierState ||
        testEarlierState.actionStateId !== earliestStateOfAction.actionStateId ||
        testEarlierState.actionStateFrameCounter >
        earliestStateOfAction.actionStateFrameCounter
    ) {
      return earliestStateOfAction.frameNumber;
    }

    earliestStateOfAction = testEarlierState;
  }
  return earliestStateOfAction.frameNumber;
}

export function getPlayerOnFrame(
    playerIndex: number,
    frameNumber: number,
    replayData: ReplayData
): PlayerUpdate | undefined {
  const index = replayData.frameIndexByNumber?.[frameNumber];
  if (index === undefined) {
    console.warn(`Frame ${frameNumber}/${replayData.settings.frameCount} not found in index`);
    return undefined;
  }
  const frame = replayData.frames[index];
  if (!frame) {
    console.warn(`No frame at index ${index}`);
    return undefined;
  }
  return frame.players[playerIndex];
}
