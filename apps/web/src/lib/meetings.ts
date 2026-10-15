import { api } from './api';

export type Role = 'host' | 'speaker' | 'audience';

export interface MeetingInfo {
  code: string;
  title: string;
  status: 'live' | 'ended';
  hostAlias: string;
  chatEnabled: boolean;
  everyoneSpeaks: boolean;
  audienceCanAsk: boolean;
  participantCount: number;
}

export interface JoinToken {
  token: string;
  url: string;
  identity: string;
  role: Role;
  meeting: { code: string; title: string; chatEnabled: boolean; audienceCanAsk: boolean };
}

export interface MyMeeting {
  code: string;
  title: string;
  status: 'live' | 'ended';
  startedAt: string;
  endedAt: string | null;
  _count: { participants: number };
}

export const meetingsApi = {
  create: (body: { title?: string; everyoneSpeaks?: boolean; audienceCanAsk?: boolean }) =>
    api.post<{ code: string; title: string; id: string }>('/meetings', body).then((r) => r.data),

  getInfo: (code: string) =>
    api.get<MeetingInfo>(`/meetings/${code}`).then((r) => r.data),

  getToken: (code: string, displayName?: string) =>
    api.post<JoinToken>(`/meetings/${code}/token`, { displayName }).then((r) => r.data),

  listMine: () => api.get<MyMeeting[]>('/meetings/mine').then((r) => r.data),

  end: (code: string) => api.post(`/meetings/${code}/end`).then((r) => r.data),

  setChat: (code: string, enabled: boolean) =>
    api.patch<{ chatEnabled: boolean }>(`/meetings/${code}/chat`, { enabled }).then((r) => r.data),

  promote: (code: string, identity: string) =>
    api.post(`/meetings/${code}/promote`, { identity }).then((r) => r.data),

  demote: (code: string, identity: string) =>
    api.post(`/meetings/${code}/demote`, { identity }).then((r) => r.data),

  mute: (code: string, identity: string) =>
    api.post(`/meetings/${code}/mute`, { identity }).then((r) => r.data),

  kick: (code: string, identity: string) =>
    api.post(`/meetings/${code}/kick`, { identity }).then((r) => r.data),
};
