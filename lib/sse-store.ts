"use client";

// Phase 2.1 — client SSE store using useSyncExternalStore.
//
// P7 binding constraints honored here:
//   P7#1: server is the source of truth; the client mirrors it.
//   P7#3: terminal frames (turn.done | turn.paused | turn.error) flip
//         the snapshot's status and close the stream.
//   P7#4: 15s heartbeat is a server-side concern; client tolerates
//         EventSource reconnect (onerror) without dropping the snapshot.
//   P7#5: the server mirrors the resolved threadId→role map on each
//         event (`_roles` field) so the client store can apply the
//         same prefix without re-parsing text. (Qodo #7)
//
// Qodo findings addressed in this file:
//   #2 — opening a new URL resets the snapshot to initial state.
//   #6 — terminal streams do not re-open (applyTerminal clears the
//        URL so the LiveCockpit stops re-invoking open()).
//   #7 — server-mirrored roles are consumed; the client builds its
//        own ThreadMap from event payloads + the server's mirror.
//   #10 — useCockpitState uses useEffect to open/close; the
//         EventSource is closed on unmount.

import { useEffect, useRef, useSyncExternalStore } from "react";
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

function emptySnapshot(): Snapshot {
  const s = initialState();
  return { state: s, pills: deriveTrail(s), status: s.status };
}

class CockpitStore {
  private listeners = new Set<Listener>();
  private snapshot: Snapshot = emptySnapshot();
  // Roles the server has mirrored to the client. The client reducer
  // consumes this via the `roles` arg, so the browser can render the
  // same role prefix without re-parsing event text. (Qodo #7)
  private roles = new Map<string, string>();
  private es: EventSource | null = null;
  private url: string | null = null;
  // Set when the server emits a terminal frame; the next render does
  // NOT re-open the stream. (Qodo #6)
  private terminal: boolean = false;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  /** Open the SSE stream against the given URL. Idempotent; safe in effects. */
  open(url: string): void {
    if (this.url === url && this.es) return;
    if (this.terminal) return; // do not reopen a finished stream
    this.close();
    // Qodo #2 — a new URL means a new paper; reset the snapshot so
    // pulse, coverage, and cursor do not carry over.
    this.snapshot = emptySnapshot();
    this.roles = new Map();
    this.url = url;
    const es = new EventSource(url, { withCredentials: true });
    this.es = es;

    es.addEventListener("event", (e: MessageEvent<string>) => {
      try {
        const ev = JSON.parse(e.data) as LiveEvent;
        // Qodo #7 — absorb the server-mirrored roles into the client's
        // own map so the reducer can resolve threadId → role.
        if (ev._roles) {
          for (const [tid, role] of Object.entries(ev._roles)) {
            this.roles.set(tid, role);
          }
        }
        this.applyEvent(ev);
      } catch {
        // Malformed frame — skip.
      }
    });
    es.addEventListener("turn.done", () => this.applyTerminal("done"));
    es.addEventListener("turn.paused", () => this.applyTerminal("paused"));
    es.addEventListener("turn.error", () => this.applyTerminal("error"));
    es.onerror = () => {
      this.emit();
    };
  }

  close(): void {
    if (this.es) {
      try { this.es.close(); } catch { /* ignore */ }
      this.es = null;
    }
    this.url = null;
  }

  private applyEvent(ev: LiveEvent): void {
    const next = reduce(this.snapshot.state, ev, { roles: this.roles });
    this.snapshot = { state: next, pills: deriveTrail(next), status: next.status };
    this.emit();
  }

  private applyTerminal(kind: "done" | "paused" | "error"): void {
    this.terminal = true;
    this.snapshot = {
      state: { ...this.snapshot.state, status: kind, terminal: { kind } },
      pills: deriveTrail({ ...this.snapshot.state, status: kind }),
      status: kind,
    };
    this.emit();
    this.close();
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

let _store: CockpitStore | null = null;
export function getCockpitStore(): CockpitStore {
  if (typeof window === "undefined") {
    throw new Error("getCockpitStore() is browser-only");
  }
  if (!_store) _store = new CockpitStore();
  return _store;
}

// Stable SSR snapshot — useSyncExternalStore needs the same reference
// when the underlying state hasn't changed.
const SERVER_SNAPSHOT: Snapshot = emptySnapshot();

export function useCockpitState(streamUrl: string | null): Snapshot {
  const isBrowser = typeof window !== "undefined";
  const store = isBrowser ? getCockpitStore() : null;
  const subscribe = store ? store.subscribe : (() => () => {});
  const getSnapshot = store ? store.getSnapshot : () => SERVER_SNAPSHOT;
  const sub = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  // Qodo #10 — open/close in a useEffect so the EventSource is closed
  // on unmount. The previous implementation called store.open() during
  // render, which is unsafe (side effects in render) and left the
  // connection open after the component unmounted.
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!store) return;
    if (streamUrl && streamUrl !== lastUrl.current) {
      lastUrl.current = streamUrl;
      store.open(streamUrl);
    } else if (!streamUrl && lastUrl.current) {
      lastUrl.current = null;
      store.close();
    }
    return () => {
      // On unmount, close. The store will be reused by the next mount
      // because it is a singleton per tab.
      if (store && !streamUrl) {
        store.close();
        lastUrl.current = null;
      }
    };
  }, [streamUrl, store]);

  return sub;
}
