import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from './auth.store';

export interface Friend {
  id: string;
  alias: string;
  region: string | null;
  gender: string | null;
  isPremium: boolean;
  isLinked: boolean;
  interests: string[];
  addedAt: string;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface SentRequest {
  id: string;
  alias: string;
  sentAt: string;
}

export interface IncomingRequest {
  id: string;       // requesterId (their userId)
  alias: string;
  sentAt: string;
}

export interface ChatMsg {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

export interface LastMessage {
  text: string;
  createdAt: string; // ISO string
  fromMe: boolean;
}

interface FriendState {
  friends: Friend[];
  sentRequests: SentRequest[];
  incomingRequests: IncomingRequest[];
  incomingFriendCall: { fromId: string; fromAlias: string } | null;
  pendingFriendCallAccept: string | null;
  friendOnlineNotif: { userId: string; alias: string } | null;
  viewProfileId: string | null;
  setViewProfileId: (id: string | null) => void;

  loadFriends: () => Promise<void>;
  loadIncomingRequests: () => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  setOnlineStatus: (id: string, isOnline: boolean) => void;
  hasFriend: (id: string) => boolean;

  sendRequest: (req: Omit<SentRequest, 'sentAt'>) => void;
  cancelRequest: (id: string) => void;
  hasRequest: (id: string) => boolean;

  addIncomingRequest: (req: IncomingRequest) => void;
  removeIncomingRequest: (requesterId: string) => void;
  addFriendFromAccept: (friend: Pick<Friend, 'id' | 'alias'>) => void;
  removeFriendLocal: (id: string) => void;
  outgoingFriendCall: { toId: string; toAlias: string } | null;
  setOutgoingFriendCall: (call: { toId: string; toAlias: string } | null) => void;
  setIncomingFriendCall: (call: { fromId: string; fromAlias: string } | null) => void;
  setPendingFriendCallAccept: (callerId: string | null) => void;
  setFriendOnlineNotif: (notif: { userId: string; alias: string } | null) => void;

  // Chat
  chatThreads: Record<string, ChatMsg[]>;
  chatUnread: Record<string, number>;
  lastMessages: Record<string, LastMessage | null>;
  addChatMessage: (friendId: string, msg: ChatMsg) => void;
  appendMyChatMessage: (friendId: string, msg: ChatMsg) => void;
  markChatRead: (friendId: string) => void;
  loadChatHistory: (friendId: string) => Promise<void>;
}

export const useFriendStore = create<FriendState>()(
  persist(
    (set, get) => ({
      friends: [],
      sentRequests: [],
      incomingRequests: [],
      incomingFriendCall: null,
      outgoingFriendCall: null,
      pendingFriendCallAccept: null,
      friendOnlineNotif: null,
      viewProfileId: null,
      setViewProfileId: (id) => set({ viewProfileId: id }),
      chatThreads: {},
      chatUnread: {},
      lastMessages: {},

      loadFriends: async () => {
        try {
          const { data } = await api.get('/friends');
          set((state) => {
            const existingOnline = new Map(state.friends.map(f => [f.id, f.isOnline]));
            const friends = (data as any[]).map(f => ({
              id: f.id,
              alias: f.alias,
              region: f.region ?? null,
              gender: f.gender ?? null,
              isPremium: f.isPremium ?? false,
              isLinked: f.isLinked ?? false,
              interests: f.interests ?? [],
              addedAt: f.addedAt,
              isOnline: existingOnline.get(f.id) ?? false,
              lastSeen: existingOnline.get(f.id) ? null : (f.lastActiveAt ?? null),
            }));
            const friendIds = new Set(friends.map((f: { id: string }) => f.id));

            const newChatUnread = { ...state.chatUnread };
            const newLastMessages = { ...state.lastMessages };
            for (const f of data as any[]) {
              if ((f.unreadCount ?? 0) > 0) {
                newChatUnread[f.id] = Math.max(newChatUnread[f.id] ?? 0, f.unreadCount);
              }
              // Only set lastMessage from DB if we don't have a more recent in-memory one
              if (f.lastMessage) {
                const existing = state.lastMessages[f.id];
                if (!existing || new Date(f.lastMessage.createdAt) > new Date(existing.createdAt)) {
                  newLastMessages[f.id] = f.lastMessage;
                }
              }
            }

            return {
              friends,
              sentRequests: state.sentRequests.filter(r => !friendIds.has(r.id)),
              chatUnread: newChatUnread,
              lastMessages: newLastMessages,
            };
          });
        } catch (err) {
          console.error('Failed to load friends:', err);
        }
      },

      loadIncomingRequests: async () => {
        try {
          const { data } = await api.get('/friends/requests');
          set({
            incomingRequests: (data as any[]).map(r => ({
              id: r.id,
              alias: r.alias,
              sentAt: r.sentAt,
            })),
          });
        } catch (err) {
          console.error('Failed to load incoming requests:', err);
        }
      },

      removeFriend: async (id) => {
        try {
          await api.delete(`/friends/${id}`);
        } catch (err) {
          console.error('Failed to remove friend:', err);
        }
        set((state) => ({ friends: state.friends.filter(f => f.id !== id) }));
      },

      setOnlineStatus: (id, isOnline) =>
        set((state) => ({
          friends: state.friends.map((f) =>
            f.id === id
              ? {
                  ...f,
                  isOnline,
                  lastSeen: isOnline
                    ? null
                    : f.isOnline
                      ? new Date().toISOString()
                      : f.lastSeen,
                }
              : f,
          ),
        })),

      hasFriend: (id) => get().friends.some((f) => f.id === id),

      sendRequest: (req) => {
        set((state) => ({
          sentRequests: state.sentRequests.some(r => r.id === req.id)
            ? state.sentRequests
            : [{ ...req, sentAt: new Date().toISOString() }, ...state.sentRequests],
        }));
        getSocket().emit('friend:request', { targetUserId: req.id });
      },

      cancelRequest: (id) =>
        set((state) => ({
          sentRequests: state.sentRequests.filter(r => r.id !== id),
        })),

      hasRequest: (id) => get().sentRequests.some((r) => r.id === id),

      addIncomingRequest: (req) =>
        set((state) => ({
          incomingRequests: state.incomingRequests.some(r => r.id === req.id)
            ? state.incomingRequests
            : [req, ...state.incomingRequests],
        })),

      removeIncomingRequest: (requesterId) =>
        set((state) => ({
          incomingRequests: state.incomingRequests.filter(r => r.id !== requesterId),
        })),

      removeFriendLocal: (id) =>
        set((state) => ({ friends: state.friends.filter(f => f.id !== id) })),

      setOutgoingFriendCall: (call) => set({ outgoingFriendCall: call }),
      setIncomingFriendCall: (call) => set({ incomingFriendCall: call }),
      setPendingFriendCallAccept: (callerId) => set({ pendingFriendCallAccept: callerId }),
      setFriendOnlineNotif: (notif) => set({ friendOnlineNotif: notif }),

      addChatMessage: (friendId, msg) =>
        set((state) => ({
          chatThreads: {
            ...state.chatThreads,
            [friendId]: [...(state.chatThreads[friendId] ?? []), msg],
          },
          chatUnread: {
            ...state.chatUnread,
            [friendId]: (state.chatUnread[friendId] ?? 0) + 1,
          },
          lastMessages: {
            ...state.lastMessages,
            [friendId]: { text: msg.text, createdAt: new Date().toISOString(), fromMe: false },
          },
        })),

      appendMyChatMessage: (friendId, msg) =>
        set((state) => ({
          chatThreads: {
            ...state.chatThreads,
            [friendId]: [...(state.chatThreads[friendId] ?? []), msg],
          },
          lastMessages: {
            ...state.lastMessages,
            [friendId]: { text: msg.text, createdAt: new Date().toISOString(), fromMe: true },
          },
        })),

      markChatRead: (friendId) =>
        set((state) => ({
          chatUnread: { ...state.chatUnread, [friendId]: 0 },
        })),

      loadChatHistory: async (friendId) => {
        try {
          const { data } = await api.get(`/friends/${friendId}/messages`);
          const myId = useAuthStore.getState().user?.id;
          const msgs: ChatMsg[] = (data as any[]).map(m => ({
            id: m.id,
            sender: m.fromUserId === myId ? 'me' as const : 'them' as const,
            text: m.text,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          const last = (data as any[]).at(-1);
          set((state) => ({
            chatThreads: { ...state.chatThreads, [friendId]: msgs },
            chatUnread: { ...state.chatUnread, [friendId]: 0 },
            lastMessages: last ? {
              ...state.lastMessages,
              [friendId]: { text: last.text, createdAt: last.createdAt, fromMe: last.fromUserId === myId },
            } : state.lastMessages,
          }));
        } catch (err) {
          console.error('Failed to load chat history:', err);
        }
      },

      addFriendFromAccept: (friend) =>
        set((state) => ({
          friends: state.friends.some(f => f.id === friend.id)
            ? state.friends
            : [
                {
                  ...friend,
                  region: null,
                  gender: null,
                  isPremium: false,
                  isLinked: false,
                  interests: [],
                  addedAt: new Date().toISOString(),
                  isOnline: true,
                  lastSeen: null,
                },
                ...state.friends,
              ],
          sentRequests: state.sentRequests.filter(r => r.id !== friend.id),
        })),
    }),
    {
      name: 'mangotalk-friends',
      partialize: (state) => ({
        friends: state.friends,
        sentRequests: state.sentRequests,
      }),
    },
  ),
);
