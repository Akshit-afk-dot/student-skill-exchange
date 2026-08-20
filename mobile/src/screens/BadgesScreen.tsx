import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { gamification } from '../api/endpoints';
import {
  Banner,
  Body,
  Caption,
  Card,
  Heading,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { plural } from '../utils/format';

/** Icon per badge, so an earned badge reads at a glance. */
const BADGE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  FIRST_SESSION: 'footsteps-outline',
  TOP_MENTOR: 'ribbon-outline',
  LEARNING_STREAK: 'flame-outline',
  HIGHLY_RATED: 'star-outline',
  KNOWLEDGE_SHARER: 'share-social-outline',
  COMMUNITY_HELPER: 'heart-outline',
  POLYGLOT: 'language-outline',
};

export function BadgesScreen() {
  const t = useTheme();
  const state = useAsync(async () => gamification.analytics(), []);

  if (state.loading) return <LoadingView />;

  const badges = state.data?.badges ?? [];
  const earned = badges.filter((b) => b.earned);

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Title>Achievements</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        {plural(earned.length, 'badge')} earned of {badges.length}.
      </Body>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      {badges.map((badge) => (
        <Card key={badge.badge} style={{ marginBottom: t.spacing.md }}>
          <Row gap={t.spacing.md}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: badge.earned ? t.colors.successSoft : t.colors.surfaceAlt,
              }}
            >
              <Ionicons
                name={BADGE_ICON[badge.badge] ?? 'trophy-outline'}
                size={22}
                color={badge.earned ? t.colors.success : t.colors.textMuted}
              />
            </View>
            <View style={{ flex: 1, opacity: badge.earned ? 1 : 0.65 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Heading>{badge.label}</Heading>
                {badge.earned ? (
                  <Ionicons name="checkmark-circle" size={19} color={t.colors.success} />
                ) : (
                  <Ionicons name="lock-closed-outline" size={16} color={t.colors.textMuted} />
                )}
              </Row>
              <Caption style={{ marginTop: 2 }}>{badge.description}</Caption>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
