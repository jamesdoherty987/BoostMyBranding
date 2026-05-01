'use client';

/**
 * Shared realtime hooks. Opens a single SSE connection per page load and
 * exposes presence, collaborative locks, and a generic subscription API.
 *
 * Reconnect policy:
 *   - EventSource auto-reconnects on transient drops, but if we get a 401
 *     or CORS error it goes straight to readyState CLOSED. We detect that
 *     and manually reopen with exponential backoff (1s → 2s → 4s → max 30s).
 *   - Visibility change resets backoff so coming back to the tab reconnects
 *     immediately.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  lockedPostId?: string;
  lastSeen: number;
}

interface RealtimeEvent {
  type: string;
  payload: any;
}

type Listener = (evt: RealtimeEvent) => void;

class RealtimeClient {
  private source: EventSource | null = null;
  private listeners = new Set<Listener>();
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  presence: PresenceUser[] = [];
  connected = false;

  constructor(private url: string) {}

  start() {
    this.stopped = false;
    this.connect();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible' && !this.connected) {
      this.reconnectDelay = 1000;
      this.connect();
    }
  };

  private connect() {
    if (this.stopped) return;
    if (this.source && this.source.readyState !== EventSource.CLOSED) return;
    try {
      this.source = new EventSource(this.url, { withCredentials: true });
      this.source.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 1000;
        this.emit({ type: 'connected', payload: null });
      };
      this.source.onerror = () => {
        this.connected = false;
        this.emit({ type: 'disconnected', payload: null });
        if (this.source?.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };
      this.source.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as RealtimeEvent;
          if (evt.type.startsWith('presence:')) {
            const list = Array.isArray(evt.payload?.list) ? evt.payload.list : evt.payload;
            if (Array.isArray(list)) this.presence = list;
          }
          this.emit(evt);
        } catch {}
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(this.reconnectDelay, 30_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.connect();
    }, delay);
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.source?.close();
    this.source = null;
    this.connected = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(evt: RealtimeEvent) {
    for (const l of this.listeners) l(evt);
  }
}

let singleton: RealtimeClient | null = null;

function getClient(url: string) {
  if (!singleton) {
    singleton = new RealtimeClient(url);
    singleton.start();
  }
  return singleton;
}

export function useRealtime(apiUrl: string, onEvent?: Listener) {
  const client = useMemo(() => getClient(`${apiUrl}/api/v1/realtime/stream`), [apiUrl]);
  const [, setTick] = useState(0);
  const [connected, setConnected] = useState(client.connected);

  useEffect(() => {
    const unsub = client.subscribe((evt) => {
      onEvent?.(evt);
      if (evt.type === 'connected') setConnected(true);
      if (evt.type === 'disconnected') setConnected(false);
      if (evt.type.startsWith('presence:')) setTick((t) => t + 1);
    });
    return () => {
      unsub();
    };
  }, [client, onEvent]);

  return {
    presence: client.presence,
    connected,
  };
}

export function usePresence(apiUrl: string) {
  const { presence, connected } = useRealtime(apiUrl);
  return { presence, connected };
}

/**
 * Claims a soft lock on a post while a teammate is reviewing it. The server
 * broadcasts to everyone so the UI can grey-out a card with "Jamie is here".
 */
export function usePostLock(apiUrl: string, postId: string | null, currentUserId?: string) {
  const { presence } = usePresence(apiUrl);
  const activePostIdRef = useRef<string | null>(null);

  useEffect(() => {
    const next = postId;
    if (activePostIdRef.current === next) return;
    activePostIdRef.current = next;
    fetch(`${apiUrl}/api/v1/realtime/lock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: next }),
    }).catch(() => {});
  }, [apiUrl, postId]);

  useEffect(() => {
    const onUnload = () => {
      navigator.sendBeacon?.(
        `${apiUrl}/api/v1/realtime/lock`,
        new Blob([JSON.stringify({ postId: null })], { type: 'application/json' }),
      );
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      fetch(`${apiUrl}/api/v1/realtime/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: null }),
      }).catch(() => {});
    };
  }, [apiUrl]);

  const getLocker = (id: string) =>
    presence.find((p) => p.lockedPostId === id && p.userId !== currentUserId);

  return { presence, getLocker };
}
