import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../theme';

/** Screen wrapper: safe-area aware, themed background, optional scrolling. */
export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['top'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const inner: StyleProp<ViewStyle> = [padded && { padding: t.spacing.lg }, style];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={t.colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.typography.title, { color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Heading({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.typography.heading, { color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted = false,
  small = false,
  numberOfLines,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        small ? t.typography.bodySmall : t.typography.body,
        { color: muted ? t.colors.textMuted : t.colors.text },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Caption({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[t.typography.caption, { color: t.colors.textMuted }, style]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
    },
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      // A pressed card dims rather than scales, which reads better in a list.
      style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? t.colors.primary
      : variant === 'danger'
        ? t.colors.danger
        : variant === 'secondary'
          ? t.colors.surfaceAlt
          : 'transparent';

  const fg =
    variant === 'primary' || variant === 'danger' ? t.colors.textInverse : t.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: t.radius.md,
          paddingVertical: 13,
          paddingHorizontal: t.spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.sm,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.spacing.lg }}>
      <Text
        style={{
          ...t.typography.caption,
          color: t.colors.textMuted,
          marginBottom: t.spacing.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      {children}
      {error ? (
        <Text style={{ color: t.colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({
  error,
  style,
  ...props
}: TextInputProps & { error?: boolean }) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.colors.textMuted}
      style={[
        {
          backgroundColor: t.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: error ? t.colors.danger : t.colors.border,
          borderRadius: t.radius.md,
          paddingHorizontal: t.spacing.md,
          paddingVertical: 12,
          fontSize: 15,
          color: t.colors.text,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Avatar({
  name,
  uri,
  size = 44,
  online,
}: {
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
}) {
  const t = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: t.colors.primary, fontWeight: '700', fontSize: size * 0.36 }}>
            {initials || '?'}
          </Text>
        </View>
      )}
      {online ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: t.colors.success,
            borderWidth: 2,
            borderColor: t.colors.surface,
          }}
        />
      ) : null}
    </View>
  );
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export function Chip({
  label,
  tone = 'neutral',
  icon,
  onPress,
  selected,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  selected?: boolean;
}) {
  const t = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.surfaceAlt, fg: t.colors.textMuted },
    primary: { bg: t.colors.primarySoft, fg: t.colors.primary },
    success: { bg: t.colors.successSoft, fg: t.colors.success },
    warning: { bg: t.colors.warningSoft, fg: t.colors.warning },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
  };
  const c = selected ? map.primary : map[tone];

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: c.bg,
        borderRadius: t.radius.pill,
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderWidth: selected ? 1 : 0,
        borderColor: t.colors.primary,
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export function StarRating({
  value,
  count,
  size = 14,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}) {
  const t = useTheme();
  if (!value && !count) {
    return <Caption>No ratings yet</Caption>;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={size} color={t.colors.star} />
      {showValue ? (
        <Text style={{ color: t.colors.text, fontSize: size - 1, fontWeight: '600' }}>
          {value.toFixed(1)}
        </Text>
      ) : null}
      {count !== undefined ? (
        <Text style={{ color: t.colors.textMuted, fontSize: size - 2 }}>
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

/** Tappable 1-5 star input used by the review form. */
export function StarPicker({
  value,
  onChange,
  size = 34,
}: {
  value: number;
  onChange(next: number): void;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === n }}
          accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
          hitSlop={6}
        >
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={size}
            color={n <= value ? t.colors.star : t.colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl }}>
      <ActivityIndicator color={t.colors.primary} />
      {label ? <Caption style={{ marginTop: t.spacing.md }}>{label}</Caption> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.spacing.xxl, paddingHorizontal: t.spacing.lg }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: t.colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.lg,
        }}
      >
        <Ionicons name={icon} size={28} color={t.colors.textMuted} />
      </View>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? (
        <Body muted style={{ textAlign: 'center', marginTop: t.spacing.sm }}>
          {message}
        </Body>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={{ marginTop: t.spacing.lg }}
        />
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

export function Banner({ tone = 'primary', text }: { tone?: Tone; text: string }) {
  const t = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.surfaceAlt, fg: t.colors.text },
    primary: { bg: t.colors.primarySoft, fg: t.colors.primary },
    success: { bg: t.colors.successSoft, fg: t.colors.success },
    warning: { bg: t.colors.warningSoft, fg: t.colors.warning },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
  };
  const c = map[tone];

  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
        marginBottom: t.spacing.lg,
      }}
      accessibilityRole="alert"
    >
      <Text style={{ color: c.fg, fontSize: 14, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

export function Divider({ spacing: gap }: { spacing?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: t.colors.border,
        marginVertical: gap ?? t.spacing.md,
      }}
    />
  );
}

export function Row({
  children,
  gap,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: gap ?? t.spacing.sm }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: t.spacing.md,
      }}
    >
      <Heading>{title}</Heading>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: t.colors.primary, fontSize: 14, fontWeight: '600' }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Compact statistic tile used on the home and analytics screens. */
export function StatTile({
  label,
  value,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
}) {
  const t = useTheme();
  const colour =
    tone === 'success'
      ? t.colors.success
      : tone === 'warning'
        ? t.colors.warning
        : tone === 'danger'
          ? t.colors.danger
          : t.colors.primary;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 100,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.colors.border,
        padding: t.spacing.md,
      }}
    >
      {icon ? <Ionicons name={icon} size={17} color={colour} /> : null}
      <Text style={{ color: t.colors.text, fontSize: 20, fontWeight: '700', marginTop: 6 }}>
        {value}
      </Text>
      <Text style={{ color: t.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export type { Theme };
