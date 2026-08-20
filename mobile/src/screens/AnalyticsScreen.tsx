import { View } from 'react-native';
import { gamification } from '../api/endpoints';
import {
  Banner,
  Body,
  Caption,
  Card,
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  StarRating,
  StatTile,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { plural } from '../utils/format';

export function AnalyticsScreen() {
  const t = useTheme();
  const state = useAsync(async () => gamification.analytics(), []);

  if (state.loading) return <LoadingView />;

  const data = state.data;
  const activity = data?.recentActivity ?? [];
  const peak = Math.max(...activity.map((a) => a.minutes), 1);

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Title>Your learning</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        Everything you have taught and learned so far.
      </Body>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.sm }}>
        <StatTile label="Hours taught" value={data?.hoursTaught ?? 0} icon="school-outline" />
        <StatTile
          label="Hours learned"
          value={data?.hoursLearned ?? 0}
          icon="book-outline"
          tone="success"
        />
      </Row>
      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.sm }}>
        <StatTile
          label="Sessions taught"
          value={data?.sessionsTaught ?? 0}
          icon="people-outline"
        />
        <StatTile
          label="Sessions attended"
          value={data?.sessionsLearned ?? 0}
          icon="person-outline"
          tone="success"
        />
      </Row>
      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.xl }}>
        <StatTile
          label="Current streak"
          value={plural(data?.streakDays ?? 0, 'day')}
          icon="flame-outline"
          tone="warning"
        />
        <StatTile label="Points" value={data?.points ?? 0} icon="trophy-outline" />
      </Row>

      <SectionHeader title="Reputation" />
      <Card style={{ marginBottom: t.spacing.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Title>{(data?.rating.average ?? 0).toFixed(1)}</Title>
            <Caption>{plural(data?.rating.count ?? 0, 'review')}</Caption>
          </View>
          <StarRating value={data?.rating.average ?? 0} size={20} showValue={false} />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: t.spacing.lg }}>
          <View>
            <Body>{data?.skillsTeaching ?? 0}</Body>
            <Caption>Skills offered</Caption>
          </View>
          <View>
            <Body>{data?.skillsLearning ?? 0}</Body>
            <Caption>Learning goals</Caption>
          </View>
          <View>
            <Body>{data?.longestStreak ?? 0}</Body>
            <Caption>Longest streak</Caption>
          </View>
        </Row>
      </Card>

      <SectionHeader title="Last 30 days" />
      {activity.length === 0 ? (
        <Card>
          <Body muted>No completed sessions in the last month.</Body>
        </Card>
      ) : (
        <Card>
          {/* A simple horizontal bar per active day: enough to read the pattern
              without pulling in a charting library. */}
          {activity.map((day) => (
            <Row key={day.date} gap={t.spacing.sm} style={{ marginBottom: 6 }}>
              <Caption style={{ width: 46 }}>{day.date.slice(5)}</Caption>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.colors.surfaceAlt,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${(day.minutes / peak) * 100}%`,
                    height: '100%',
                    backgroundColor: t.colors.primary,
                  }}
                />
              </View>
              <Caption style={{ width: 54, textAlign: 'right' }}>
                {(day.minutes / 60).toFixed(1)}h
              </Caption>
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}
