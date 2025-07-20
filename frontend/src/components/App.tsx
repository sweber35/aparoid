/* @refresh reload */
import { createDropzone } from "@solid-primitives/upload";
import "@thisbeyond/solid-select/style.css";
import { Show } from "solid-js";
import { filterFiles } from "~/common/util";
import { ToastGroup } from "~/components/common/toaster";
import { Navigation } from "~/components/panels/Navigation";
import { Sidebar } from "~/components/panels/Sidebar";
import { Viewer } from "~/components/viewer/Viewer";
import { DebugPanel } from "~/components/panels/DebugPanel";
import { load } from "~/state/fileStore";
import { replayStore } from "~/state/awsStore";
import { fetchAnimations } from "~/viewer/animationCache";
import "~/state/fileStore";
import "~/state/awsStore";
import "~/state/themeStore"; // Initialize theme system
import { setSidebar } from "~/state/navigationStore";

export function App() {
  // Get started fetching the most popular characters
  void fetchAnimations(20); // Falco
  void fetchAnimations(2); // Fox
  void fetchAnimations(0); // Falcon
  void fetchAnimations(9); // Marth

  // Make the whole screen a dropzone
  const { setRef: dropzoneRef } = createDropzone({
    onDrop: async (uploads) => {
      setSidebar("local replays");
      const files = uploads.map((upload) => upload.file);
      const filteredFiles = await filterFiles(files);
      await load(filteredFiles);
    },
  });

  // Broken: load a file from query params if provided.
  const url = new URLSearchParams(location.search).get("replayUrl");
  const frameParse = Number(location.hash.split("#").at(-1));
  const startFrame = Number.isNaN(frameParse) ? 0 : frameParse;
  if (url !== null) {
    try {
      void fetch(url)
        .then(async (response) => await response.blob())
        .then((blob) => new File([blob], url.split("/").at(-1) ?? "url.slp"))
        .then(async (file) => await load([file], startFrame));
    } catch (e) {
      console.error("Error: could not load replay", url, e);
    }
  }

  return (
    <>
      <Show
        when={!replayStore.isFullscreen}
        fallback={
          <div class="flex h-screen h-[100dvh] flex-col justify-between overflow-y-auto">
            <Viewer />
            <DebugPanel />
          </div>
        }
      >
        <div
          class="container"
          ref={dropzoneRef}
        >
          <div class="Viewer">
            <Viewer />
            <DebugPanel />
          </div>
          <Sidebar />
        </div>
      </Show>
    </>
  );
}
