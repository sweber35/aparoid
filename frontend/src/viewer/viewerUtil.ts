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

  while (earliestStateOfAction.frameNumber > 0) {
    const previousFrameNumber = earliestStateOfAction.frameNumber - 1;

    // Check if the previous frame exists in the replay data
    if (previousFrameNumber < 0 || previousFrameNumber >= replayData.frames.length) {
      console.warn(
          `Aborting backtrack: Frame ${previousFrameNumber} not found in replay (available frames: 0-${replayData.frames.length - 1})`
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
  // Since frames are now 0-indexed, we can use the frameNumber directly as the array index
  const frame = replayData.frames[frameNumber];
  if (!frame) {
    console.warn(`Frame ${frameNumber} not found in replay data (available frames: 0-${replayData.frames.length - 1})`);
    return undefined;
  }
  return frame.players[playerIndex];
}
