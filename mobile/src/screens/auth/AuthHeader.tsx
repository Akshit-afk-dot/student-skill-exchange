import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { PopIn } from '../../components/motion';
import { Body, IconButton, Title } from '../../components/ui';
import { useTheme } from '../../theme';

/**
 * The top of every sign-in screen: the app's mark, a title, and one line on why.
 *
 * The mark is the same tile the onboarding screen ends on, shrunk, so moving from the
 * welcome to a form feels like the same place rather than a new one.
 */
export function AuthHeader({
  title,
  subtitle,
  icon = 'swap-horizontal',
}: {
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTheme();
  const navigation = useNavigation();
  return (
    <View style={{ marginBottom: t.spacing.xl }}>
      {/* The auth stack has no header bar, so going back lives here. */}
      <View style={{ height: 44, marginLeft: -t.spacing.sm, marginBottom: t.spacing.md }}>
        {navigation.canGoBack() ? (
          <IconButton icon="arrow-back" tone="plain" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        ) : null}
      </View>
      <PopIn>
        <View
          style={[
            {
              width: 56,
              height: 56,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: t.spacing.xl,
              backgroundColor: t.colors.primary,
            },
            t.elevation(2),
          ]}
        >
          <Ionicons name={icon} size={28} color={t.colors.onPrimary} />
        </View>
      </PopIn>
      <Title>{title}</Title>
      <Body muted style={{ marginTop: t.spacing.xs }}>
        {subtitle}
      </Body>
    </View>
  );
}
