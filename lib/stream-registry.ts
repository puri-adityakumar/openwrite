// Qodo review round 2 — active-stream registry.
//
// The advertised Pause must actually suspend execution: the SSE loop
// serving a paper's live turn registers its cancel hook here so the
// halt route can tear it down mid-flight. Without this, pausing only
// flips papers.status while the stream keeps flowing and its terminal
// update overwrites the pause.
//
// Single-process by design (Next dev / single container demo); a
// multi-instance deployment would move this to Redis pub/sub.

const active = new Map<string, () => void>();

export function registerActiveStream(paperId: string, cancel: () => void): void {
  // One live stream per paper — a reattach replaces the stale hook.
  active.set(paperId, cancel);
}

export function unregisterActiveStream(paperId: string, cancel: () => void): void {
  // Only drop the hook that is still current: an old stream cleaning
  // up late must not remove a newer registration.
  if (active.get(paperId) === cancel) active.delete(paperId);
}

export function cancelActiveStream(paperId: string): boolean {
  const cancel = active.get(paperId);
  if (!cancel) return false;
  try {
    cancel();
  } catch {
    // The stream's own cleanup owns error handling.
  }
  return true;
}
