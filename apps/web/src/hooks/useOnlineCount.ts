import { useEffect, useState } from 'react';
import { useSocketEvent, useSocket } from './useSocket';

export function useOnlineCount(fallback = 0) {
  const [count, setCount] = useState(fallback);
  const socket = useSocket();

  useEffect(() => {
    socket.emit('online:count:request');
  }, [socket]);

  useSocketEvent('online:count', ({ count: c }) => {
    setCount(c);
  });

  return count + 100;
}
