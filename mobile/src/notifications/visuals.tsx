import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Avatar, Text, toneColours } from '../components/ui';
import { useTheme } from '../theme';
import { kindOf } from './kinds';
import type { NotificationData } from './open';

/**
 * The face of a notification.
 *
 * When a person caused it (a message, a request, a review), their photo or initials lead,
 * with a small badge for the kind of event, the way iOS draws communication notifications
 * and Android's guide asks for "an avatar of the sender". Otherwise (a reminder, a badge
 * earned) a softly tinted tile with the event's icon.
 */
export function NotificationGlyph({
  type,
  data,
  size = 44,
  ring,
}: {
  type: string;
  data?: NotificationData;
  size?: number;
  /** The colour behind the glyph, so the badge's cut-out ring matches it. */
  ring?: string;
}) {
  const t = useTheme();
  const kind = kindOf(type);
  const tint = toneColours(t, kind.tone);
  const person = data?.actorName;

  if (!person) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: tint.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={kind.icon} size={size * 0.46} color={tint.fg} />
      </View>
    );
  }

  const badge = Math.round(size * 0.44);
  return (
    <View style={{ width: size, height: size }}>
      <Avatar name={person} uri={data?.actorImage} size={size} />
      <View
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          width: badge + 4,
          height: badge + 4,
          borderRadius: (badge + 4) / 2,
          backgroundColor: ring ?? t.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: tint.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={kind.icon} size={badge * 0.58} color={tint.fg} />
        </View>
      </View>
    </View>
  );
}

/** The surface a floating notification sits on, per theme. */
export function useCardSurface(): string {
  const t = useTheme();
  // In dark mode depth comes from lightness, not shadow, so a floating card steps up two
  // surfaces from the page it covers.
  return t.dark ? t.colors.surfaceContainerHigh : t.colors.surface;
}

/**
 * A notification as a card: glyph, title, body. The in-app banner is this card, and the
 * permission prompt shows two of them as a preview of what will arrive.
 */
export function NotificationCard({
  type,
  title,
  body,
  data,
  style,
  showHandle = false,
}: {
  type: string;
  title: string;
  body: string;
  data?: NotificationData;
  style?: StyleProp<ViewStyle>;
  /** The small grabber that says the banner can be swiped away. */
  showHandle?: boolean;
}) {
  const t = useTheme();
  const surface = useCardSurface();

  return (
    <View
      style={[
        {
          backgroundColor: surface,
          borderRadius: t.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border,
          paddingHorizontal: t.spacing.md + 2,
          paddingTop: t.spacing.md + 2,
          paddingBottom: showHandle ? t.spacing.sm + 2 : t.spacing.md + 2,
        },
        t.elevation(3),
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <NotificationGlyph type={type} data={data} ring={surface} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: t.fonts.semibold, fontSize: 15, lineHeight: 20, color: t.colors.textPrimary }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontSize: 14, lineHeight: 19, color: t.colors.textSecondary, marginTop: 1 }}
          >
            {body}
          </Text>
        </View>
      </View>
      {showHandle ? (
        <View
          style={{
            alignSelf: 'center',
            width: 32,
            height: 4,
            borderRadius: 2,
            // `border` vanishes on the raised dark surface; a faded outline reads in both themes.
            backgroundColor: t.colors.outline,
            opacity: 0.45,
            marginTop: t.spacing.sm,
          }}
        />
      ) : null}
    </View>
  );
}
