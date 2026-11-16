import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text } from '../components/Text';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import type { MainTabParamList } from './types';

type IconName = keyof typeof Ionicons.glyphMap;

/** Filled when active, outlined at rest: the shape change reads even without colour. */
const TAB_ICONS: Record<keyof MainTabParamList, { on: IconName; off: IconName }> = {
  HomeTab: { on: 'home', off: 'home-outline' },
  ExploreTab: { on: 'compass', off: 'compass-outline' },
  // The same two arrows as the app icon: this tab is what the app is for.
  MatchesTab: { on: 'swap-horizontal', off: 'swap-horizontal-outline' },
  ChatsTab: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  ProfileTab: { on: 'person', off: 'person-outline' },
};

const BAR_HEIGHT = 66;
const PILL_WIDTH = 60;
const PILL_HEIGHT = 32;

/**
 * The bottom tab bar.
 *
 * One pill sits behind the active tab's icon and slides to whichever tab is chosen,
 * rather than each tab lighting up on its own. Seeing the highlight travel makes it
 * obvious which way you moved. Labels are always shown: icons alone are a guessing game.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const tabWidth = count > 0 ? width / count : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (tabWidth === 0) return;
    const target = state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2;
    // The first position is set, not animated: the pill should not fly in on launch.
    if (!placed.current) {
      placed.current = true;
      x.value = target;
      return;
    }
    x.value = withSpring(target, t.motion.springs.spatialFast);
  }, [state.index, tabWidth, x, t.motion.springs.spatialFast]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        height: BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: t.colors.bgElevated,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.colors.border,
      }}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 9,
              left: 0,
              width: PILL_WIDTH,
              height: PILL_HEIGHT,
              borderRadius: PILL_HEIGHT / 2,
              backgroundColor: t.colors.primarySoft,
            },
            pill,
          ]}
        />
      ) : null}

      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options;
        const label = options?.title ?? route.name;
        const badge = typeof options?.tabBarBadge === 'number' ? options.tabBarBadge : 0;
        const icons = TAB_ICONS[route.name as keyof MainTabParamList];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (focused || event.defaultPrevented) return;
          // One notch of a selector: the lightest haptic that still registers.
          haptics.selection();
          navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
            style={{ flex: 1, alignItems: 'center', paddingTop: 9 }}
          >
            <TabIcon
              focused={focused}
              name={focused ? (icons?.on ?? 'ellipse') : (icons?.off ?? 'ellipse-outline')}
              color={focused ? t.colors.primary : t.colors.textMuted}
              badge={badge}
            />
            <Text
              numberOfLines={1}
              style={{
                marginTop: 3,
                fontSize: 11.5,
                lineHeight: 15,
                fontWeight: focused ? '700' : '600',
                color: focused ? t.colors.primary : t.colors.textMuted,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The icon gives a small bounce as its tab becomes active. */
function TabIcon({
  focused,
  name,
  color,
  badge,
}: {
  focused: boolean;
  name: IconName;
  color: string;
  badge: number;
}) {
  const t = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!focused) return;
    scale.value = withSpring(1.18, t.motion.springs.bouncy, () => {
      scale.value = withSpring(1, t.motion.springs.spatialFast);
    });
  }, [focused, scale, t.motion.springs]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[{ width: PILL_WIDTH, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons name={name} size={23} color={color} />
      {badge > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: 8,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            borderRadius: 9,
            backgroundColor: t.colors.danger,
            borderWidth: 2,
            borderColor: t.colors.bgElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: t.colors.onDanger, fontSize: 11, lineHeight: 14, fontWeight: '800' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
