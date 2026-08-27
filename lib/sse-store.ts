"use client";

// Phase 2.1 — client SSE store using useSyncExternalStore.
//
// P7 binding constraints honored here:
//   P7#1: the server is the source of truth for the reducer; the client
//         mirrors it for rendering. The browser's native EventSource
//         delivers typed MessageEvents; we feed each one into the
//         reducer and call useSyncExternalStore's emit.
//   P7#3: terminal frames (turn.done | turn.paused | turn.error) flip
//         the snapshot's status and close the stream.
//   P7#4: the 15 s heartbeat is a server-side concern; the client
//         tolerates the EventSource reconnect (onerror) without
//         dropping the snapshot.
//
// Note: we do not bundle the `eventsource-parser` package on the
// client — the browser's native EventSource already gives us typed
// events. The package remains available for any Node-side consumer
// (tests, future edge handlers) but is not imported here.

import { useSyncExternalStore } from "react";
import {
  initialState,
  reduce,
  deriveTrail,
  type LiveState,
  type LiveEvent,
} from "./event-reducer";

type Listener = () => void;

type Snapshot = {
  state: LiveState;
  pills: ReturnType<typeof deriveTrail>;
  status: LiveState["status"];
};

class CockpitStore {
  private listeners = new Set<Listener>();
  private snapshot: Snapshot = {
    state: initialState(),
    pills: deriveTrail(initialState()),
    status: "queued",
  };
  private es: EventSource | null = null;
  private url: string | null = null;
  private closed = false;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  /** Open the SSE stream against the given URL (typically /api/agent/stream?...). */
  open(url: string): void {
    if (this.url === url && this.es) return; // idempotent
    this.close();
    this.url = url;
    this.closed = false;
    const es = new EventSource(url, { withCredentials: true });
    this.es = es;

    es.addEventListener("event", (e: MessageEvent<string>) => {
      // Per-event frame from the route: `data:` carries the full LiveEvent JSON.
      try {
        const ev = JSON.parse(e.data) as LiveEvent;
        this.applyEvent(ev);
      } catch {
        // Malformed frame — skip.
      }
    });
    es.addEventListener("turn.done", (e: MessageEvent<string>) => {
      this.applyTerminal("done", e.data);
    });
    es.addEventListener("turn.paused", (e: MessageEvent<string>) => {
      this.applyTerminal("paused", e.data);
    });
    es.addEventListener("turn.error", (e: MessageEvent<string>) => {
      this.applyTerminal("error", e.data);
    });
    es.onerror = () => {
      // EventSource auto-reconnects with the server's `retry:` value.
      // We just bump a render so the UI shows the current state.
      this.emit();
    };
  }

  private applyEvent(ev: LiveEvent): void {
    const next = reduce(this.snapshot.state, ev);
    this.snapshot = { state: next, pills: deriveTrail(next), status: next.status };
    this.emit();
  }

  private applyTerminal(kind: "done" | "paused" | "error", _data: string): void {
    const status: LiveState["status"] = kind;
    this.snapshot = {
      state: { ...this.snapshot.state, status, terminal: { kind } },
      pills: deriveTrail({ ...this.snapshot.state, status }),
      status,
    };
    this.emit();
    this.close();
  }

  close(): void {
    if (this.es) {
      try { this.es.close(); } catch { /* ignore */ }
      this.es = null;
    }
    this.url = null;
  }

  /** Test/dev hook: seed the store without a real EventSource. */
  __setStateForTest(s: LiveState): void {
    this.snapshot = { state: s, pills: deriveTrail(s), status: s.status };
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

// Singleton per browser tab. The Next.js client runtime is one tab.
let _store: CockpitStore | null = null;
export function getCockpitStore(): CockpitStore {
  if (typeof window === "undefined") {
    throw new Error("getCockpitStore() is browser-only");
  }
  if (!_store) _store = new CockpitStore();
  return _store;
}

// Fallback snapshot for SSR — useSyncExternalStore requires a stable
// reference per call so we return a fresh-but-equal object on each
// server-side render. (The store swaps in on the first client render.)
const SERVER_SNAPSHOT: Snapshot = {
  state: initialState(),
  pills: deriveTrail(initialState()),
  status: "queued",
};

export function useCockpitState(streamUrl: string | null): Snapshot {
  // The store is browser-only; on the server we return the static
  // snapshot so the markup renders without throwing.
  const isBrowser = typeof window !== "undefined";
  const store = isBrowser ? getCockpitStore() : null;
  const subscribe = store ? store.subscribe : (() => () => {});
  const getSnapshot = store ? store.getSnapshot : () => SERVER_SNAPSHOT;
  const sub = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  if (store && streamUrl) {
    // Open is idempotent; safe to call on every render.
    store.open(streamUrl);
  } else if (store) {
    store.close();
  }
  return sub;
}
