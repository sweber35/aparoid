import { onCleanup, onMount, Show } from "solid-js";
import { MinusIcon, PlusIcon } from "~/components/common/icons";
import {
  adjust,
  jump,
  jumpPercent,
  pause,
  replayStore,
  speedFast,
  speedNormal,
  speedSlow,
  toggleDebug,
  toggleFullscreen,
  togglePause,
  zoomIn,
  zoomOut,
} from "~/state/awsStore";

import { currentSelectionStore, toggleFullReplayDebug, getFullReplayDebugState } from "~/state/awsSelectionStore";

export function Controls() {
  onMount(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  });
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  });

  function onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case "k":
      case "K":
      case " ":
        event.preventDefault(); // Prevent default browser scrolling
        togglePause();
        break;
      case "ArrowRight":
      case "l":
      case "L":
        event.preventDefault();
        adjust(120);
        break;
      case "ArrowLeft":
      case "j":
      case "J":
        event.preventDefault();
        adjust(-120);
        break;
      case ".":
      case ">":
        event.preventDefault();
        pause();
        adjust(1);
        break;
      case ",":
      case "<":
        event.preventDefault();
        pause();
        adjust(-1);
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        jumpPercent(Number(event.key) * 0.1); // convert 3 => 30%
        break;
      case "ArrowUp":
        event.preventDefault();
        speedSlow();
        break;
      case "ArrowDown":
        event.preventDefault();
        speedFast();
        break;
      case "-":
      case "_":
        zoomOut();
        break;
      case "=":
      case "+":
        zoomIn();
        break;
      case "]":
      case "}":
        currentSelectionStore()?.nextFile();
        break;
      case "[":
      case "{":
        currentSelectionStore()?.previousFile();
        break;
      // case "'":
      // case '"':
      //   nextHighlight();
      //   break;
      // case ";":
      // case ":":
      //   previousHighlight();
      //   break;
      case "d":
      case "D":
        toggleDebug();
        toggleFullReplayDebug();
        break;
      case "f":
      case "F":
        toggleFullscreen();
        break;
    }
  }

  function onKeyUp({ key }: KeyboardEvent): void {
    switch (key) {
      case "ArrowUp":
      case "ArrowDown":
        speedNormal();
        break;
    }
  }

  let seekbarInput!: HTMLInputElement;

  return (
    <div class="flex flex-wrap items-center justify-evenly gap-4 rounded-b border border-t-0 py-1 px-2 text-slate-800">
      <Show
        when={replayStore.running}
        fallback={
          <div
            class="material-icons cursor-pointer text-[32px] leading-none"
            onClick={() => togglePause()}
            aria-label="Resume playback"
          >
            play_arrow
          </div>
        }
      >
        <div
          class="material-icons cursor-pointer text-[32px]"
          onClick={() => togglePause()}
          aria-label="pause playback"
        >
          pause
        </div>
      </Show>
      <div class="flex items-center gap-1">
        <div
          class="material-icons cursor-pointer text-[32px]"
          onClick={() => adjust(-120)}
          aria-label="Rewind 2 seconds"
        >
          history
        </div>
        <MinusIcon
          class="h-6 w-6"
          role="button"
          title="previous frame"
          onClick={() => {
            pause();
            adjust(-1);
          }}
        >
          -
        </MinusIcon>
        <label for="seekbar" class="font-mono text-sm">
          {replayStore.frame}
          {getFullReplayDebugState() && (
            <span class="ml-2 text-xs text-orange-600 bg-orange-100 px-1 rounded" title="Full replay debug mode active">
              FULL
            </span>
          )}
        </label>
        <PlusIcon
          class="h-6 w-6"
          role="button"
          title="next frame"
          onClick={() => {
            pause();
            adjust(1);
          }}
        >
          +
        </PlusIcon>
        <div
          class="material-icons cursor-pointer text-[32px]"
          onClick={() => adjust(120)}
          aria-label="Skip ahead 2 seconds"
        >
          update
        </div>
      </div>
      <input
        id="seekbar"
        class="flex-grow accent-slippi-500"
        type="range"
        ref={seekbarInput}
        value={replayStore.frame}
        max={replayStore.replayData!.frames.length - 1}
        onInput={() => jump(seekbarInput.valueAsNumber)}
      />
      <div
        class="material-icons cursor-pointer text-[32px]"
        onClick={() => toggleFullscreen()}
        aria-label="Toggle fullscreen mode"
      >
        {replayStore.isFullscreen ? "fullscreen_exit" : "fullscreen"}
      </div>
    </div>
  );
}
