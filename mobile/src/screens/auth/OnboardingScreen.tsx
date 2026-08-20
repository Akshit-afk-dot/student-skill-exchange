import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, View, type ViewToken } from 'react-native';
import { Body, Button, Screen, Title } from '../../components/ui';
import { useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'swap-horizontal',
    title: 'Trade skills, not money',
    body: 'You know Python. Someone else knows Photoshop. Teach each other instead of paying for two courses.',
  },
  {
    icon: 'sparkles',
    title: 'Matched both ways',
    body: 'We look for students whose learning goals fit what you teach — and whose teaching fits what you want to learn.',
  },
  {
    icon: 'calendar',
    title: 'Chat, schedule, learn',
    body: 'Message your match, book a session that suits you both, and build a rating other students can trust.',
  },
];

const { width } = Dimensions.get('window');

export function OnboardingScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  // Kept in a ref: FlatList treats this callback as immutable after first render and
  // warns if a new function identity is passed on re-render.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const isLast = index === SLIDES.length - 1;

  function next() {
    if (isLast) {
      navigation.navigate('Register');
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View
            style={{
              width,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: t.spacing.xl,
              gap: t.spacing.lg,
            }}
          >
            <View
              style={{
                width: 108,
                height: 108,
                borderRadius: 54,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.icon} size={50} color={t.colors.primary} />
            </View>
            <Title style={{ textAlign: 'center' }}>{item.title}</Title>
            <Body muted style={{ textAlign: 'center', lineHeight: 22 }}>
              {item.body}
            </Body>
          </View>
        )}
      />

      <View style={{ padding: t.spacing.xl, gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: t.spacing.sm }}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.title}
              style={{
                width: i === index ? 20 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? t.colors.primary : t.colors.border,
              }}
            />
          ))}
        </View>

        <Button label={isLast ? 'Create an account' : 'Next'} onPress={next} />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => navigation.navigate('Login')}
        />
      </View>
    </Screen>
  );
}
