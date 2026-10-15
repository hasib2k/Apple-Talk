import { create } from 'zustand';

/**
 * In-memory hand-off from the lobby (pre-join) to the room page:
 * the chosen display name and whether the mic starts enabled.
 */
interface MeetingState {
  displayName: string;
  micEnabled: boolean;
  setPrejoin: (p: { displayName: string; micEnabled: boolean }) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  displayName: '',
  micEnabled: true,
  setPrejoin: ({ displayName, micEnabled }) => set({ displayName, micEnabled }),
}));
