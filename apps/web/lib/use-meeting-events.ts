'use client';

import * as React from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { MeetingEvent } from '@irm/shared';
import { api } from './api';

export interface UseMeetingEventsOptions {
  /** API path under /api/v1, e.g. `/companies/.../live/events` or `/participant/meetings/.../live/events`. */
  eventsPath: string | null;
  /** Query keys to invalidate whenever a live pointer event arrives or the stream reconnects. */
  queryKeys: readonly QueryKey[];
  /** Optional heartbeat POST path under /api/v1 for participant presence. */
  heartbeatPath?: string | null;
  /** Optional callback for transient UI announcements (e.g. polite aria-live status). */
  onEvent?: (event: MeetingEvent) => void;
}

export function useMeetingEvents({
  eventsPath,
  queryKeys,
  heartbeatPath,
  onEvent,
}: UseMeetingEventsOptions): { connected: boolean } {
  const qc = useQueryClient();
  const [connected, setConnected] = React.useState(false);

  const keysRef = React.useRef(queryKeys);
  const onEventRef = React.useRef(onEvent);
  const lastSeqRef = React.useRef<number | null>(null);
  const hadOpenRef = React.useRef(false);

  React.useEffect(() => {
    keysRef.current = queryKeys;
    onEventRef.current = onEvent;
  }, [queryKeys, onEvent]);

  React.useEffect(() => {
    if (!eventsPath || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const invalidateAll = () => {
      for (const key of keysRef.current) {
        void qc.invalidateQueries({ queryKey: key });
      }
    };

    const es = new EventSource(`/api/v1${eventsPath}`, { withCredentials: true });

    es.onopen = () => {
      setConnected(true);
      if (hadOpenRef.current) {
        invalidateAll();
      }
      hadOpenRef.current = true;
    };

    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as MeetingEvent;
        lastSeqRef.current = ev.seq;
        onEventRef.current?.(ev);
      } catch {
        // Ignore malformed frames; still refresh authoritative REST state below.
      }
      invalidateAll();
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [eventsPath, qc]);

  React.useEffect(() => {
    if (!heartbeatPath || typeof window === 'undefined') return;
    const id = window.setInterval(() => {
      void api.post(heartbeatPath).catch(() => {});
    }, 25_000);
    return () => window.clearInterval(id);
  }, [heartbeatPath]);

  return { connected: Boolean(eventsPath) && connected };
}
