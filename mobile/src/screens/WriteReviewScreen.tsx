import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';
import { reviews as reviewsApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Field,
  Input,
  Screen,
  StarPicker,
  Title,
} from '../components/ui';
import { useAction } from '../hooks/useAsync';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';

const RATING_LABEL: Record<number, string> = {
  1: 'Not helpful',
  2: 'Could be better',
  3: 'Fine',
  4: 'Good session',
  5: 'Excellent',
};

export function WriteReviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sessionId, revieweeName } =
    useRoute<RouteProp<RootStackParamList, 'WriteReview'>>().params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const submit = useAction(async () => {
    await reviewsApi.create({
      sessionId,
      rating,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    navigation.goBack();
    return true;
  });

  return (
    <Screen scroll>
      <Title>Rate your session</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.xl }}>
        How was learning with {revieweeName}? Your rating helps other students decide who
        to reach out to.
      </Body>

      {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

      <View style={{ alignItems: 'center', marginBottom: t.spacing.xl }}>
        <StarPicker value={rating} onChange={setRating} />
        <Caption style={{ marginTop: t.spacing.md, height: 18 }}>
          {rating > 0 ? RATING_LABEL[rating] : 'Tap a star'}
        </Caption>
      </View>

      <Field
        label="Add a comment (optional)"
        hint="Specific feedback is far more useful than a bare star rating."
      >
        <Input
          value={comment}
          onChangeText={setComment}
          placeholder="e.g. Explained recursion with clear examples and was patient with my questions."
          multiline
          numberOfLines={5}
          maxLength={1000}
          style={{ minHeight: 118, textAlignVertical: 'top' }}
        />
      </Field>

      <Button
        label="Submit rating"
        onPress={() => void submit.run()}
        loading={submit.pending}
        disabled={rating === 0}
      />

      <Caption style={{ textAlign: 'center', marginTop: t.spacing.md }}>
        You can edit or withdraw this within 24 hours.
      </Caption>
    </Screen>
  );
}
