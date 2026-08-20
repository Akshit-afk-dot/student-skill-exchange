import { useRoute, type RouteProp } from '@react-navigation/native';
import { FlatList, View } from 'react-native';
import { reviews as reviewsApi } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Card,
  Chip,
  EmptyState,
  Heading,
  LoadingView,
  Row,
  Screen,
  StarRating,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { timeAgo } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

export function ReviewsScreen() {
  const t = useTheme();
  const { userId, userName } = useRoute<RouteProp<RootStackParamList, 'Reviews'>>().params;
  const state = useAsync(async () => reviewsApi.forUser(userId, 1), [userId]);

  if (state.loading) return <LoadingView />;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Title>Reviews</Title>
        <Body muted style={{ marginTop: 4 }}>
          What students say about {userName}.
        </Body>
      </View>

      <FlatList
        data={state.data?.items ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: t.spacing.lg, paddingTop: t.spacing.sm }}
        refreshing={state.refreshing}
        onRefresh={state.refresh}
        ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title="No reviews yet"
            message={`${userName} has not been rated yet. Ratings appear after a completed session.`}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: t.spacing.md }}>
            <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
              <Avatar name={item.reviewer.name} uri={item.reviewer.profileImage} size={38} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Heading numberOfLines={1} style={{ flex: 1 }}>
                    {item.reviewer.name}
                  </Heading>
                  <Caption>{timeAgo(item.createdAt)}</Caption>
                </Row>

                <Row gap={t.spacing.sm} style={{ marginTop: 4 }}>
                  <StarRating value={item.rating} showValue={false} />
                  <Caption>{item.rating}/5</Caption>
                  {item.skill ? <Chip label={item.skill.name} tone="primary" /> : null}
                </Row>

                {item.comment ? (
                  <Body small style={{ marginTop: t.spacing.sm }}>
                    {item.comment}
                  </Body>
                ) : null}
              </View>
            </Row>
          </Card>
        )}
      />
    </Screen>
  );
}
