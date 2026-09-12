import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ExploreTab: undefined;
  MatchesTab: undefined;
  ChatsTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;

  StudentProfile: { userId: string };
  SearchResults: { skillId?: string; skillName?: string; q?: string };
  MySkills: undefined;
  AddSkill: { type: 'TEACH' | 'LEARN' };
  EditProfile: undefined;

  LearningRequests: undefined;
  SendRequest: { userId: string; userName: string; skillId?: string };
  Connections: undefined;
  Chat: { conversationId: string; partnerName: string; partnerId: string };

  MySessions: undefined;
  ScheduleSession: { partnerId: string; partnerName: string; skillId?: string };
  SessionDetails: { sessionId: string };
  Calendar: undefined;

  Reviews: { userId: string; userName: string };
  WriteReview: { sessionId: string; revieweeName: string };
  Leaderboard: undefined;
  Badges: undefined;
  Analytics: undefined;

  Notifications: undefined;
  Settings: undefined;
  ReportUser: { userId: string; userName: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // Gives `navigation.navigate` autocomplete everywhere without importing the type.
    // The empty body is the point — this is React Navigation's documented module
    // augmentation, which works by interface merging rather than by adding members.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
