import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { connections, matching, users as usersApi } from '../api/endpoints';
import { FadeInView } from '../components/motion';
import { ScoreBar, ScoreRing } from '../components/ScoreRing';
import {
  Avatar,
  Banner,
  Body,
  BottomBar,
  Button,
  Caption,
  Card,
  Chip,
  Divider,
  ErrorView,
  Heading,
  ListRow,
  LoadingView,
  Overline,
  Row,
  Screen,
  SectionHeader,
  Text,
  Title,
  VerifiedName,
} from '../components/ui';
import { haptics } from '../haptics';
import { useAction, useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEVEL_LABEL, plural, reasonText, slotLabel } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

/** How the score is put into words. The number alone does not say whether 58 is good. */
function verdict(percent: number): string {
  if (percent >= 80) return 'Excellent match';
  if (percent >= 60) return 'Strong match';
  if (percent >= 40) return 'Good match';
  return 'Some overlap';
}

/** A small stat under the name: icon, number, word. */
function Meta({ icon, value, label, colour }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; colour: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 2 }} accessible accessibilityLabel={`${value} ${label}`}>
      <Row gap={4}>
        <Ionicons name={icon} size={15} color={colour} />
        <Text style={[t.typography.heading, { color: t.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      </Row>
      <Caption>{label}</Caption>
    </View>
  );
}

/**
 * The trade at a glance: what flows each way between you. Orange is what you would
 * learn, violet what you would teach, the same colours as everywhere else in the app.
 */
function TradeCard({
  learn,
  teach,
}: {
  learn: Array<{ id: string; name: string }>;
  teach: Array<{ id: string; name: string }>;
}) {
  const t = useTheme();
  // `side` keeps text clear of the exchange badge sitting on the seam between the columns.
  const column = (
    label: string,
    skills: Array<{ id: string; name: string }>,
    bg: string,
    fg: string,
    side: 'left' | 'right',
  ) => (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: t.radius.lg,
        padding: t.spacing.md,
        [side === 'left' ? 'paddingRight' : 'paddingLeft']: 24,
        minHeight: 92,
      }}
    >
      <Row gap={5} style={{ marginBottom: 6 }}>
        <Ionicons name={side === 'left' ? 'book' : 'school'} size={13} color={fg} />
        <Overline style={{ color: fg }}>{label}</Overline>
      </Row>
      {skills.length === 0 ? (
        <Caption style={{ color: fg }}>Nothing yet</Caption>
      ) : (
        skills.slice(0, 3).map((s) => (
          <Text key={s.id} numberOfLines={1} style={{ color: t.colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '700' }}>
            {s.name}
          </Text>
        ))
      )}
      {skills.length > 3 ? <Caption style={{ color: fg }}>+{skills.length - 3} more</Caption> : null}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: t.spacing.sm }}>
      {column('You learn', learn, t.colors.tertiaryContainer, t.colors.onTertiaryContainer, 'left')}
      {column('You teach', teach, t.colors.primaryContainer, t.colors.onPrimaryContainer, 'right')}
      {/* The exchange mark sits on the seam between the two columns. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={[
            {
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: t.colors.surface,
              borderWidth: 3,
              borderColor: t.colors.background,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Ionicons name="swap-horizontal" size={16} color={t.colors.textPrimary} />
        </View>
      </View>
    </View>
  );
}

export function StudentProfileScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId } = useRoute<RouteProp<RootStackParamList, 'StudentProfile'>>().params;
  const { user } = useAuth();

  const isSelf = user?.id === userId;

  const load = useCallback(
    async () =>
      Promise.all([
        usersApi.profile(userId),
        connections.with(userId).catch(() => ({ connected: false, conversationId: null })),
        // The match explanation is a nice-to-have; a failure should not blank the page.
        isSelf ? Promise.resolve(null) : matching.explain(userId).catch(() => null),
      ]),
    [userId, isSelf],
  );

  const state = useAsync(load, [userId]);

  const setBlocked = useAction(async (blocked: boolean) => {
    if (blocked) {
      await usersApi.block(userId);
      haptics.warn();
    } else {
      await usersApi.unblock(userId);
      haptics.success();
    }
    state.reload();
    return true;
  });

  if (state.loading) return <LoadingView />;
  if (state.error || !state.data) {
    return <ErrorView message={state.error ?? 'Profile not found'} onRetry={state.reload} />;
  }

  const [profile, connection, match] = state.data;
  const firstName = profile.name.split(' ')[0] ?? profile.name;

  function confirmBlock() {
    haptics.warn();
    Alert.alert(
      `Block ${profile.name}?`,
      'You will not see each other in matches or search, and neither of you can send requests or messages. Any connection between you ends. We do not tell them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void setBlocked.run(true) },
      ],
    );
  }

  const skillNames = new Map<string, string>();
  for (const s of match?.theyTeachYouWant ?? []) skillNames.set(s.id, s.name);
  for (const s of match?.youTeachTheyWant ?? []) skillNames.set(s.id, s.name);
  const reasons = (match?.reasons ?? [])
    .filter((r) => r.code !== 'TWO_WAY_EXCHANGE')
    .map((r) => reasonText(r, skillNames))
    .filter(Boolean)
    .slice(0, 3);

  const connected = connection.connected && Boolean(connection.conversationId);

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg, paddingBottom: t.spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => {
              haptics.refresh();
              state.refresh();
            }}
            tintColor={t.colors.primary}
            colors={[t.colors.primary]}
          />
        }
      >
        {/* Identity */}
        <View style={{ alignItems: 'center' }}>
          <Avatar
            name={profile.name}
            uri={profile.profileImage}
            size={96}
            online={profile.isOnline}
            {...(match?.twoWay ? { ring: t.colors.success } : {})}
          />
          <View style={{ marginTop: t.spacing.md, alignItems: 'center' }}>
            <VerifiedName name={profile.name} verified={profile.verified} size="title" />
          </View>
          {profile.college ? (
            <Body muted small style={{ marginTop: 2, textAlign: 'center' }}>
              {profile.college}
              {profile.department ? ` · ${profile.department}` : ''}
              {profile.year ? ` · Year ${profile.year}` : ''}
            </Body>
          ) : null}
          {profile.isOnline ? (
            <Row gap={5} style={{ marginTop: t.spacing.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.success }} />
              <Caption style={{ color: t.colors.success, fontWeight: '600' }}>Online now</Caption>
            </Row>
          ) : null}
        </View>

        <Card style={{ marginTop: t.spacing.lg, paddingVertical: t.spacing.md }}>
          <Row>
            <Meta
              icon="star"
              colour={t.colors.reward}
              value={profile.rating.count > 0 ? profile.rating.average.toFixed(1) : '—'}
              label={plural(profile.rating.count, 'review')}
            />
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: t.colors.border }} />
            <Meta icon="school" colour={t.colors.primary} value={String(profile.stats.sessionsTaught)} label="taught" />
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: t.colors.border }} />
            <Meta icon="flame" colour={t.colors.reward} value={String(profile.stats.points)} label="points" />
          </Row>
        </Card>

        {/* The match: the reason this screen was opened. The ring is felt as it fills. */}
        {match ? (
          <FadeInView delay={120}>
            <Card
              style={{
                marginTop: t.spacing.lg,
                borderColor: match.twoWay ? t.colors.success : t.colors.border,
                borderWidth: match.twoWay ? 1.5 : undefined,
              }}
              elevated={2}
            >
              <Row gap={t.spacing.lg}>
                <ScoreRing
                  percent={match.matchPercent}
                  size={104}
                  twoWay={match.twoWay}
                  label="match"
                  delay={350}
                  felt
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Heading>{verdict(match.matchPercent)}</Heading>
                  {match.twoWay ? (
                    <Row>
                      <Chip label="Two-way exchange" tone="success" icon="swap-horizontal" />
                    </Row>
                  ) : null}
                  {reasons.map((text) => (
                    <Row key={text} gap={6} style={{ alignItems: 'flex-start' }}>
                      <Ionicons name="checkmark-circle" size={15} color={t.colors.success} style={{ marginTop: 1 }} />
                      <Caption style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{text}</Caption>
                    </Row>
                  ))}
                </View>
              </Row>

              <View style={{ marginTop: t.spacing.lg }}>
                <TradeCard learn={match.theyTeachYouWant} teach={match.youTeachTheyWant} />
              </View>

              {/* Showing the working makes the score auditable instead of asking for trust. */}
              <View
                style={{
                  marginTop: t.spacing.lg,
                  paddingTop: t.spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: t.colors.border,
                }}
              >
                <Overline style={{ marginBottom: t.spacing.md }}>How this score is built</Overline>
                <ScoreBar label="Skill fit" value={match.breakdown.skill ?? 0} weight={0.4} index={0} />
                <ScoreBar label="Shared free time" value={match.breakdown.availability ?? 0} weight={0.2} index={1} />
                <ScoreBar label="Experience level" value={match.breakdown.experience ?? 0} weight={0.15} index={2} />
                <ScoreBar label="Rating" value={match.breakdown.rating ?? 0} weight={0.15} index={3} />
                <ScoreBar label="Location" value={match.breakdown.location ?? 0} weight={0.1} index={4} />
              </View>
            </Card>
          </FadeInView>
        ) : null}

        {profile.bio ? (
          <View style={{ marginTop: t.spacing.xl }}>
            <SectionHeader title={`About ${firstName}`} />
            <Body>{profile.bio}</Body>
          </View>
        ) : null}

        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader title="Can teach" />
          {profile.teaches.length === 0 ? (
            <Body muted>No teaching skills listed yet.</Body>
          ) : (
            <Card style={{ padding: 0 }}>
              {profile.teaches.map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 ? <Divider spacing={0} /> : null}
                  <Row style={{ justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, minHeight: 52 }}>
                    <Row gap={10} style={{ flex: 1 }}>
                      <Ionicons name="school" size={15} color={t.colors.primary} />
                      <Body style={{ flex: 1 }} numberOfLines={1}>
                        {entry.skill.name}
                      </Body>
                    </Row>
                    <Chip label={LEVEL_LABEL[entry.level]} tone="teach" />
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </View>

        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader title="Wants to learn" />
          {profile.learns.length === 0 ? (
            <Body muted>No learning goals listed yet.</Body>
          ) : (
            <Card style={{ padding: 0 }}>
              {profile.learns.map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 ? <Divider spacing={0} /> : null}
                  <Row style={{ justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, minHeight: 52 }}>
                    <Row gap={10} style={{ flex: 1 }}>
                      <Ionicons name="book" size={15} color={t.colors.tertiary} />
                      <Body style={{ flex: 1 }} numberOfLines={1}>
                        {entry.skill.name}
                      </Body>
                    </Row>
                    <Chip label={LEVEL_LABEL[entry.level]} tone="learn" />
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </View>

        {profile.availability.length > 0 ? (
          <View style={{ marginTop: t.spacing.xl }}>
            <SectionHeader title="Usually free" />
            <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
              {profile.availability.map((slot, i) => (
                <Chip key={`${slot.day}-${slot.start}-${i}`} label={slotLabel(slot)} icon="time-outline" />
              ))}
            </Row>
          </View>
        ) : null}

        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader
            title="Reviews"
            actionLabel={profile.reviewSummary.count > 0 ? 'See all' : undefined}
            onAction={() => navigation.navigate('Reviews', { userId: profile.id, userName: profile.name })}
          />
          {profile.reviewSummary.count === 0 ? (
            <Body muted>No reviews yet.</Body>
          ) : (
            <Card>
              <Row gap={t.spacing.xl}>
                <View style={{ alignItems: 'center' }}>
                  <Title>{profile.reviewSummary.average.toFixed(1)}</Title>
                  <Row gap={1}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= Math.round(profile.reviewSummary.average) ? 'star' : 'star-outline'}
                        size={12}
                        color={t.colors.reward}
                      />
                    ))}
                  </Row>
                  <Caption style={{ marginTop: 2 }}>{plural(profile.reviewSummary.count, 'review')}</Caption>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = profile.reviewSummary.distribution[String(star)] ?? 0;
                    const pct = profile.reviewSummary.count ? (count / profile.reviewSummary.count) * 100 : 0;
                    return (
                      <Row key={star} gap={6}>
                        <Caption style={{ width: 10 }}>{star}</Caption>
                        <View
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: t.colors.surfaceContainer,
                            overflow: 'hidden',
                          }}
                        >
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.colors.reward }} />
                        </View>
                      </Row>
                    );
                  })}
                </View>
              </Row>
            </Card>
          )}
        </View>

        {isSelf ? (
          <View style={{ marginTop: t.spacing.xl }}>
            <Banner tone="primary" text="This is how other students see your profile." />
          </View>
        ) : (
          <View style={{ marginTop: t.spacing.xl }}>
            {setBlocked.error ? <Banner tone="danger" text={setBlocked.error} /> : null}
            {profile.blockedByMe ? (
              <Banner
                tone="warning"
                text={`You have blocked ${profile.name}. You cannot find, request or message each other.`}
              />
            ) : null}
            <Card style={{ padding: 0 }}>
              <ListRow
                icon="flag"
                title="Report"
                subtitle="Tell us about a problem with this student"
                onPress={() => navigation.navigate('ReportUser', { userId: profile.id, userName: profile.name })}
              />
              <Divider spacing={0} />
              {profile.blockedByMe ? (
                <ListRow
                  icon="checkmark-circle"
                  title={`Unblock ${firstName}`}
                  onPress={() => void setBlocked.run(false)}
                />
              ) : (
                <ListRow
                  icon="ban"
                  destructive
                  title={`Block ${firstName}`}
                  subtitle="They will not be told"
                  onPress={confirmBlock}
                />
              )}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* The main action stays under the thumb instead of at the end of a long scroll. */}
      {!isSelf && !profile.blockedByMe ? (
        <BottomBar>
          {connected ? (
            <Row gap={t.spacing.sm}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Message"
                  icon="chatbubble"
                  onPress={() =>
                    navigation.navigate('Chat', {
                      conversationId: connection.conversationId as string,
                      partnerName: profile.name,
                      partnerId: profile.id,
                    })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Schedule"
                  variant="secondary"
                  icon="calendar"
                  onPress={() =>
                    navigation.navigate('ScheduleSession', { partnerId: profile.id, partnerName: profile.name })
                  }
                />
              </View>
            </Row>
          ) : (
            <Button
              label={`Send ${firstName} a request`}
              icon="paper-plane"
              loading={setBlocked.pending}
              onPress={() =>
                navigation.navigate('SendRequest', {
                  userId: profile.id,
                  userName: profile.name,
                  ...(match?.theyTeachYouWant[0] ? { skillId: match.theyTeachYouWant[0].id } : {}),
                })
              }
            />
          )}
        </BottomBar>
      ) : null}
    </Screen>
  );
}
