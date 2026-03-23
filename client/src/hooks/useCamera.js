// Placeholder — Track B (Agent 2) implements this hook
// See docs/TRACK_B_GUIDE.md for full specification
export function useCamera() {
  return {
    videoRef: { current: null },
    stream: null,
    isLoading: false,
    error: null,
  };
}
