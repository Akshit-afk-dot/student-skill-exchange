import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chat, requests } from '../api/endpoints';
import { RT, onEvent } from '../api/socket';
import { Caption, LoadingView } from '../components/ui';
import { haptics } from '../utils/haptics';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';

import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

import { AddSkillScreen } from '../screens/AddSkillScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { BadgesScreen } from '../screens/BadgesScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ConnectionsScreen } from '../screens/ConnectionsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { LearningRequestsScreen } from '../screens/LearningRequestsScreen';
import { MatchesScreen } from '../screens/MatchesScreen';
import { MySessionsScreen } from '../screens/MySessionsScreen';
import { MySkillsScreen } from '../screens/MySkillsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReportUserScreen } from '../screens/ReportUserScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';
import { ScheduleSessionScreen } from '../screens/ScheduleSessionScreen';
import { SearchResultsScreen } from '../screens/SearchResultsScreen';
import { SendRequestScreen } from '../screens/SendRequestScreen';
import { SessionDetailsScreen } from '../screens/SessionDetailsScreen';
import { BlockedUsersScreen } from '../screens/BlockedUsersScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StudentProfileScreen } from '../screens/StudentProfileScreen';
import { WriteReviewScreen } from '../screens/WriteReviewScreen';

import type { AuthStackParamList, MainTabParamList, RootStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

/** Small red count on a tab icon. */
function TabBadge({ count }: { count: number }) {
  const t = useTheme();
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -10,
        minWidth: 17,
        height: 17,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: t.colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Caption style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
        {count > 99 ? '99+' : count}
      </Caption>
    </View>
  );
}

/**
 * Tab icon that lifts and swells when its tab becomes active.
 *
 * Small, but it is the interaction a user performs most often in the app, so it is the
 * one most worth making feel deliberate.
 */
function TabIcon({
  focused,
  name,
  activeName,
  color,
  size,
  badge,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  badge?: number;
}) {
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 260, mass: 0.6 });
  }, [focused, lift]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * lift.value }, { scale: 1 + 0.12 * lift.value }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name={focused ? activeName : name} size={size} color={color} />
      {badge !== undefined ? <TabBadge count={badge} /> : null}
    </Animated.View>
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { on: 'home', off: 'home-outline' },
  ExploreTab: { on: 'compass', off: 'compass-outline' },
  MatchesTab: { on: 'git-compare', off: 'git-compare-outline' },
  ChatsTab: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  ProfileTab: { on: 'person', off: 'person-outline' },
};

function TabNavigator() {
  const t = useTheme();
  const [unreadChats, setUnreadChats] = useState(0);

  // Badge counts are polled once on mount and then kept current by socket events,
  // rather than polled on a timer.
  useEffect(() => {
    const refresh = () => {
      void chat.unreadCount().then((r) => setUnreadChats(r.count)).catch(() => undefined);
    };
    refresh();

    const offMessage = onEvent(RT.MESSAGE_NEW, refresh);
    const offRead = onEvent(RT.MESSAGE_READ, refresh);
    return () => {
      offMessage();
      offRead();
    };
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          // The default height leaves the label almost no room under the larger active
          // icon on phones without a gesture bar, so it is set explicitly.
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <TabIcon
              focused={focused}
              name={icons.off}
              activeName={icons.on}
              color={color}
              size={size}
              {...(route.name === 'ChatsTab' ? { badge: unreadChats } : {})}
            />
          );
        },
      })}
      screenListeners={{
        // A tick on every tab change, so switching sections is felt as well as seen.
        tabPress: () => haptics.selection(),
      }}
    >
      <Tabs.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
      <Tabs.Screen name="ExploreTab" component={ExploreScreen} options={{ title: 'Explore' }} />
      <Tabs.Screen name="MatchesTab" component={MatchesScreen} options={{ title: 'Matches' }} />
      <Tabs.Screen name="ChatsTab" component={ChatListScreen} options={{ title: 'Chats' }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const t = useTheme();

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bg },
        headerTintColor: t.colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <RootStack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />

      <RootStack.Screen
        name="StudentProfile"
        component={StudentProfileScreen}
        options={{ title: 'Profile' }}
      />
      <RootStack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{ title: 'Results' }}
      />
      <RootStack.Screen name="MySkills" component={MySkillsScreen} options={{ title: 'My skills' }} />
      <RootStack.Screen
        name="AddSkill"
        component={AddSkillScreen}
        options={{ title: 'Add skill', presentation: 'modal' }}
      />
      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit profile' }}
      />

      <RootStack.Screen
        name="LearningRequests"
        component={LearningRequestsScreen}
        options={{ title: 'Requests' }}
      />
      <RootStack.Screen
        name="SendRequest"
        component={SendRequestScreen}
        options={{ title: 'Send request', presentation: 'modal' }}
      />
      <RootStack.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{ title: 'Connections' }}
      />
      <RootStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />

      <RootStack.Screen
        name="MySessions"
        component={MySessionsScreen}
        options={{ title: 'Sessions' }}
      />
      <RootStack.Screen
        name="ScheduleSession"
        component={ScheduleSessionScreen}
        options={{ title: 'Schedule', presentation: 'modal' }}
      />
      <RootStack.Screen
        name="SessionDetails"
        component={SessionDetailsScreen}
        options={{ title: 'Session' }}
      />
      <RootStack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />

      <RootStack.Screen name="Reviews" component={ReviewsScreen} options={{ title: 'Reviews' }} />
      <RootStack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: 'Rate session', presentation: 'modal' }}
      />
      <RootStack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: 'Leaderboard' }}
      />
      <RootStack.Screen name="Badges" component={BadgesScreen} options={{ title: 'Achievements' }} />
      <RootStack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />

      <RootStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <RootStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <RootStack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: 'Blocked students' }}
      />
      <RootStack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: 'Delete account' }}
      />
      <RootStack.Screen
        name="ReportUser"
        component={ReportUserScreen}
        options={{ title: 'Report', presentation: 'modal' }}
      />
    </RootStack.Navigator>
  );
}

export function Navigation() {
  const t = useTheme();
  const { user, initialising } = useAuth();

  // The splash state: hold here until the stored session has been checked, so a
  // signed-in student never sees the login screen flash on cold start.
  if (initialising) return <LoadingView label="Loading…" />;

  const navTheme = t.dark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: t.colors.bg,
          card: t.colors.surface,
          text: t.colors.text,
          border: t.colors.border,
          primary: t.colors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: t.colors.bg,
          card: t.colors.surface,
          text: t.colors.text,
          border: t.colors.border,
          primary: t.colors.primary,
        },
      };

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <RootNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

/** Re-exported for screens that want the pending-request count. */
export async function pendingRequestCount(): Promise<number> {
  const result = await requests.pendingCount();
  return result.count;
}
