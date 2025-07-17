import { createSignal, Show } from "solid-js";
import { apiClient, API_CONFIG } from "~/config";
import { loadReplayData } from "~/state/awsStore";
import { ReplayData } from "~/common/types";

export function ReplayQuery() {
    const [matchId, setMatchId] = createSignal("");
    const [frameStart, setFrameStart] = createSignal("0");
    const [frameEnd, setFrameEnd] = createSignal("1000");
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [success, setSuccess] = createSignal<string | null>(null);

    async function handleQueryReplay() {
        if (!matchId().trim()) {
            setError("Please enter a match ID");
            return;
        }

        const start = parseInt(frameStart());
        const end = parseInt(frameEnd());

        if (isNaN(start) || isNaN(end)) {
            setError("Please enter valid frame numbers");
            return;
        }

        if (start < 0 || end < 0) {
            setError("Frame numbers must be non-negative");
            return;
        }

        if (start > end) {
            setError("Frame start must be less than or equal to frame end");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
        
            const response = await fetch(API_CONFIG.replayData, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: matchId().trim(),
                    frameStart: start,
                    frameEnd: end
                }),
            });

            if (!response.ok) {
                throw new Error(`Lambda fetch failed: ${response.statusText}`);
            }

            const result = await response.json();

            if (result && result.frames) {
                // Load the replay data into the store
                const replayData: ReplayData = result;
                

                
                loadReplayData(replayData);
                
                setSuccess(`Successfully loaded replay with ${replayData.frames.length} frames (${start}-${end})`);
                setMatchId(""); // Clear the input
            } else {
                setError("No replay data found for this match ID and frame range");
            }
        } catch (err) {
            console.error("Error querying replay:", err);
            setError(err instanceof Error ? err.message : "Failed to load replay");
        } finally {
            setLoading(false);
        }
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === "Enter") {
            handleQueryReplay();
        }
    }

    return (
        <div class="w-full p-4 bg-white rounded-lg border border-gray-200">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Query Replay Segment</h3>
            
            <div class="space-y-4">
                <div>
                    <label for="matchId" class="block text-sm font-medium text-gray-700 mb-1">
                        Match ID
                    </label>
                    <input
                        id="matchId"
                        type="text"
                        value={matchId()}
                        onInput={(e) => setMatchId(e.currentTarget.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter match ID..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading()}
                    />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="frameStart" class="block text-sm font-medium text-gray-700 mb-1">
                            Frame Start
                        </label>
                        <input
                            id="frameStart"
                            type="number"
                            min="0"
                            value={frameStart()}
                            onInput={(e) => setFrameStart(e.currentTarget.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="0"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading()}
                        />
                    </div>
                    <div>
                        <label for="frameEnd" class="block text-sm font-medium text-gray-700 mb-1">
                            Frame End
                        </label>
                        <input
                            id="frameEnd"
                            type="number"
                            min="0"
                            value={frameEnd()}
                            onInput={(e) => setFrameEnd(e.currentTarget.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="1000"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading()}
                        />
                    </div>
                </div>

                <button
                    onClick={handleQueryReplay}
                    disabled={loading() || !matchId().trim()}
                    class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {loading() ? (
                        <>
                            <span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                            Loading...
                        </>
                    ) : (
                        "Load Replay Segment"
                    )}
                </button>

                <Show when={error()}>
                    <div class="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                        {error()}
                    </div>
                </Show>

                <Show when={success()}>
                    <div class="text-green-600 text-sm bg-green-50 p-3 rounded-md">
                        {success()}
                    </div>
                </Show>
            </div>
        </div>
    );
} 