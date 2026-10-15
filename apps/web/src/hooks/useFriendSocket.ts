import { useEffect } from 'react';
import { useSocketEvent, useSocket } from './useSocket';
import { useFriendStore } from '../store/friend.store';

export function useFriendSocket() {
  const { addIncomingRequest, addFriendFromAccept, cancelRequest, removeFriendLocal, setIncomingFriendCall, setOnlineStatus, setFriendOnlineNotif, addChatMessage, friends } = useFriendStore();
  const socket = useSocket();

  // On socket connect/reconnect, check online status of all friends
  useEffect(() => {
    function onConnect() {
      const ids = useFriendStore.getState().friends.map(f => f.id);
      if (ids.length > 0) {
        socket.emit('users:status-check', { userIds: ids });
      }
    }
    socket.on('connect', onConnect);
    // Also check immediately if already connected
    if (socket.connected) onConnect();
    return () => { socket.off('connect', onConnect); };
  }, [socket]);

  // Apply users:online-status result to friend store
  useSocketEvent('users:online-status', ({ onlineIds }) => {
    const onlineSet = new Set(onlineIds);
    useFriendStore.getState().friends.forEach(f => {
      setOnlineStatus(f.id, onlineSet.has(f.id));
    });
  });

  // Someone sent us a friend request
  useSocketEvent('friend:request', ({ fromId, fromAlias }) => {
    addIncomingRequest({ id: fromId, alias: fromAlias, sentAt: new Date().toISOString() });
  });

  // Our request was accepted
  useSocketEvent('friend:accepted', ({ byId, byAlias }) => {
    addFriendFromAccept({ id: byId, alias: byAlias });
    cancelRequest(byId);
  });

  // Our request was rejected
  useSocketEvent('friend:rejected', ({ byId }) => {
    cancelRequest(byId);
  });

  // The other user removed us as a friend
  useSocketEvent('friend:removed', ({ byId }) => {
    removeFriendLocal(byId);
  });

  // Caller cancelled the outgoing call before receiver responded
  useSocketEvent('friend:call-cancelled', () => {
    useFriendStore.getState().setIncomingFriendCall(null);
  });

  // A friend is calling us
  useSocketEvent('friend:incoming-call', ({ fromId, fromAlias }) => {
    const allowed = localStorage.getItem('mangotalk_allow_incoming') !== 'false';
    const isFriend = useFriendStore.getState().hasFriend(fromId);
    if (!allowed && !isFriend) {
      socket.emit('friend:call-decline', { callerId: fromId });
      return;
    }
    setIncomingFriendCall({ fromId, fromAlias });
  });

  // A friend came online
  useSocketEvent('friend:online', ({ userId, alias }) => {
    setOnlineStatus(userId, true);
    if (alias) setFriendOnlineNotif({ userId, alias });
  });

  // A friend went offline
  useSocketEvent('friend:offline', ({ userId }) => {
    setOnlineStatus(userId, false);
  });

  // Incoming chat message from a friend (globally captured regardless of current page)
  useSocketEvent('friend:chat', ({ id, fromUserId, text, time }: { id?: string; fromUserId: string; text: string; time: string }) => {
    addChatMessage(fromUserId, {
      id: id ?? Date.now().toString(),
      sender: 'them',
      text,
      time,
    });
  });
}
