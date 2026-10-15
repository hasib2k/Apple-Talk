import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import type { ServerToClientEvents } from '@mangotalk/types';

type EventKey = keyof ServerToClientEvents;
type EventHandler<K extends EventKey> = ServerToClientEvents[K];

export function useSocketEvent<K extends EventKey>(event: K, handler: EventHandler<K>) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const wrappedHandler = (...args: Parameters<EventHandler<K>>) => {
      (handlerRef.current as (...a: Parameters<EventHandler<K>>) => void)(...args);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on(event, wrappedHandler);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (socket as any).off(event, wrappedHandler); };
  }, [event]);
}

export function useSocket() {
  return getSocket();
}
