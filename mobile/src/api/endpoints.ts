import { api, qs } from './client';
import type {
  AppNotification,
  AuthTokens,
  BadgeInfo,
  BlockedStudent,
  CalendarEntry,
  ChatMessage,
  ConnectionView,
  ConversationView,
  LeaderboardEntry,
  LearningAnalytics,
  LearningRequest,
  LearningSession,
  MatchCandidate,
  Paginated,
  ProfileDetail,
  Review,
  SearchResultUser,
  SelfUser,
  SessionMode,
  Skill,
  SkillCategory,
  SkillLevel,
  UserSkillEntry,
} from '../types';

/** One place where every endpoint the app uses is named and typed. */

interface AuthPayload {
  user: SelfUser;
  tokens: AuthTokens;
}

export const auth = {
  register: (body: {
    name: string;
    email: string;
    password: string;
    college?: string;
    department?: string;
    year?: number;
    acceptTerms?: boolean;
  }) => api.post<AuthPayload>('/auth/register', body),

  login: (email: string, password: string) =>
    api.post<AuthPayload>('/auth/login', { email, password }),

  google: (idToken: string) => api.post<AuthPayload>('/auth/google', { idToken }),

  me: () => api.get<{ user: SelfUser }>('/auth/me'),

  logout: (refreshToken: string) => api.post<{ success: boolean }>('/auth/logout', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),

  resetPassword: (email: string, otp: string, password: string) =>
    api.post<{ success: boolean }>('/auth/reset-password', { email, otp, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean }>('/auth/change-password', { currentPassword, newPassword }),

  resendVerification: () => api.post<{ success: boolean }>('/auth/resend-verification'),

  registerPushToken: (token: string) => api.post<{ success: boolean }>('/auth/push-token', { token }),

  unregisterPushToken: (token: string) =>
    api.delete<{ success: boolean }>('/auth/push-token', { token }),
};

export interface UserSearchFilters {
  q?: string;
  skill?: string;
  level?: SkillLevel;
  college?: string;
  language?: string;
  minRating?: number;
  mode?: string;
  onlineNow?: boolean;
  longitude?: number;
  latitude?: number;
  radiusKm?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export const users = {
  search: (filters: UserSearchFilters) =>
    api.get<Paginated<SearchResultUser>>(`/users${qs({ ...filters })}`),

  facets: () =>
    api.get<{
      colleges: Array<{ value: string; count: number }>;
      languages: Array<{ value: string; count: number }>;
      topSkills: Array<{ id: string; name: string; teachCount: number }>;
    }>('/users/facets'),

  profile: (id: string) => api.get<ProfileDetail>(`/users/${id}`),

  me: () => api.get<ProfileDetail & SelfUser>('/users/me'),

  updateProfile: (body: Record<string, unknown>) =>
    api.patch<{ user: SelfUser }>('/users/me', body),

  updateLocation: (longitude: number, latitude: number, city?: string) =>
    api.put<{ user: SelfUser }>('/users/me/location', { longitude, latitude, city }),

  blocked: () => api.get<BlockedStudent[]>('/users/me/blocked'),

  block: (id: string) => api.post<{ blocked: boolean }>(`/users/${id}/block`),

  unblock: (id: string) => api.delete<{ blocked: boolean }>(`/users/${id}/block`),

  deleteAccount: (password?: string) =>
    api.delete<{ deleted: boolean }>('/users/me', password ? { password } : {}),
};

export const skills = {
  categories: () => api.get<SkillCategory[]>('/skills/categories'),

  search: (params: { q?: string; category?: string; page?: number; limit?: number }) =>
    api.get<Paginated<Skill>>(`/skills${qs(params)}`),

  popular: () => api.get<{ mostTaught: Skill[]; mostWanted: Skill[] }>('/skills/popular'),

  mine: () => api.get<{ teaches: UserSkillEntry[]; learns: UserSkillEntry[] }>('/user-skills'),

  add: (body: {
    skillId?: string;
    skillName?: string;
    categoryId?: string;
    type: 'TEACH' | 'LEARN';
    level: SkillLevel;
    yearsOfExperience?: number;
    description?: string;
    priority?: number;
  }) => api.post<UserSkillEntry>('/user-skills', body),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch<UserSkillEntry>(`/user-skills/${id}`, body),

  remove: (id: string) => api.delete<void>(`/user-skills/${id}`),
};

export const matching = {
  recommendations: (params: {
    page?: number;
    limit?: number;
    twoWayOnly?: boolean;
    minScore?: number;
    skill?: string;
  }) => api.get<Paginated<MatchCandidate>>(`/matches${qs(params)}`),

  explain: (userId: string) => api.get<MatchCandidate>(`/matches/${userId}`),

  weights: () =>
    api.get<{
      skill: number;
      availability: number;
      experience: number;
      rating: number;
      location: number;
      exchangeBonus: number;
      maxDistanceKm: number;
    }>('/matches/weights'),
};

export const requests = {
  create: (body: {
    receiverId: string;
    skillId: string;
    offeredSkillId?: string;
    message: string;
  }) => api.post<LearningRequest>('/requests', body),

  list: (params: { direction: 'incoming' | 'outgoing'; status?: string; page?: number }) =>
    api.get<Paginated<LearningRequest>>(`/requests${qs(params)}`),

  pendingCount: () => api.get<{ count: number }>('/requests/pending-count'),

  accept: (id: string) =>
    api.post<{ request: LearningRequest; connectionId: string; conversationId: string }>(
      `/requests/${id}/accept`,
    ),

  reject: (id: string) => api.post<LearningRequest>(`/requests/${id}/reject`),

  cancel: (id: string) => api.post<LearningRequest>(`/requests/${id}/cancel`),
};

export const connections = {
  list: (page = 1) => api.get<Paginated<ConnectionView>>(`/connections${qs({ page })}`),

  with: (userId: string) =>
    api.get<{ connected: boolean; conversationId: string | null }>(`/connections/with/${userId}`),

  remove: (id: string) => api.delete<void>(`/connections/${id}`),
};

export const chat = {
  conversations: (page = 1) =>
    api.get<Paginated<ConversationView>>(`/conversations${qs({ page })}`),

  unreadCount: () => api.get<{ count: number }>('/conversations/unread-count'),

  messages: (conversationId: string, params: { limit?: number; before?: string } = {}) =>
    api.get<{ items: ChatMessage[]; hasMore: boolean; nextCursor?: string }>(
      `/conversations/${conversationId}/messages${qs(params)}`,
    ),

  send: (
    conversationId: string,
    body: {
      body?: string;
      type?: 'TEXT' | 'IMAGE' | 'FILE';
      attachment?: { url: string; mimeType: string; size: number; name?: string };
    },
  ) => api.post<ChatMessage>(`/conversations/${conversationId}/messages`, body),

  markRead: (conversationId: string) =>
    api.post<{ markedRead: number }>(`/conversations/${conversationId}/read`),

  deleteMessage: (messageId: string) => api.delete<void>(`/conversations/messages/${messageId}`),
};

export const sessions = {
  create: (body: {
    partnerId: string;
    role: 'TEACHER' | 'LEARNER';
    skillId: string;
    scheduledAt: string;
    durationMinutes: number;
    mode: SessionMode;
    meetingLink?: string;
    location?: string;
    notes?: string;
  }) => api.post<LearningSession>('/sessions', body),

  list: (params: {
    status?: string;
    when?: 'upcoming' | 'past';
    role?: 'teacher' | 'learner';
    page?: number;
  }) => api.get<Paginated<LearningSession>>(`/sessions${qs(params)}`),

  calendar: (from: string, to: string) =>
    api.get<CalendarEntry[]>(`/sessions/calendar${qs({ from, to })}`),

  get: (id: string) => api.get<LearningSession>(`/sessions/${id}`),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch<LearningSession>(`/sessions/${id}`, body),

  confirm: (id: string) => api.post<LearningSession>(`/sessions/${id}/confirm`),

  cancel: (id: string, reason?: string) =>
    api.post<LearningSession>(`/sessions/${id}/cancel`, { reason }),

  complete: (id: string) =>
    api.post<{ session: LearningSession; fullyCompleted: boolean; message: string }>(
      `/sessions/${id}/complete`,
    ),
};

export const reviews = {
  create: (body: { sessionId: string; rating: number; comment?: string }) =>
    api.post<Review>('/reviews', body),

  forUser: (userId: string, page = 1) =>
    api.get<Paginated<Review>>(`/reviews/user/${userId}${qs({ page })}`),

  written: (page = 1) => api.get<Paginated<Review>>(`/reviews/written${qs({ page })}`),

  pending: () => api.get<LearningSession[]>('/reviews/pending'),

  update: (id: string, body: { rating?: number; comment?: string }) =>
    api.patch<Review>(`/reviews/${id}`, body),

  remove: (id: string) => api.delete<void>(`/reviews/${id}`),
};

export const reports = {
  create: (body: {
    reportedUserId: string;
    reason: string;
    description?: string;
    relatedMessageId?: string;
    relatedSessionId?: string;
  }) => api.post<{ report: unknown; message: string }>('/reports', body),

  mine: (page = 1) => api.get<Paginated<unknown>>(`/reports/mine${qs({ page })}`),
};

export const notifications = {
  list: (params: { unreadOnly?: boolean; page?: number } = {}) =>
    api.get<Paginated<AppNotification>>(`/notifications${qs(params)}`),

  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),

  markRead: (ids: string[]) => api.post<{ markedRead: number }>('/notifications/read', { ids }),

  markAllRead: () => api.post<{ markedRead: number }>('/notifications/read-all'),
};

export const gamification = {
  leaderboard: (params: { scope?: 'global' | 'college'; college?: string; page?: number } = {}) =>
    api.get<Paginated<LeaderboardEntry>>(`/gamification/leaderboard${qs(params)}`),

  analytics: (userId?: string) =>
    api.get<LearningAnalytics>(`/gamification/analytics${userId ? `/${userId}` : ''}`),

  badges: () => api.get<BadgeInfo[]>('/gamification/badges'),
};

export const uploads = {
  avatar: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    // React Native's FormData accepts this shape for file parts; the cast is required
    // because the DOM typing expects a Blob.
    form.append('file', file as unknown as Blob);
    return api.upload<{ url: string }>('/uploads/avatar', form);
  },

  attachment: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    return api.upload<{
      url: string;
      mimeType: string;
      size: number;
      name: string;
      type: 'IMAGE' | 'FILE';
    }>('/uploads/attachment', form);
  },
};
