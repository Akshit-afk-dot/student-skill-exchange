import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { sessions as sessionsApi } from '../api/endpoints';
import { CalendarEntryCard } from '../components/cards';
import {
  Banner,
  Body,
  Caption,
  EmptyState,
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Month view.
 *
 * Renders a plain 7-column grid rather than pulling in a calendar library: the only
 * interaction needed is "which days have sessions, and what is on this day".
 */
export function CalendarScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(dayjs().format('YYYY-MM-DD'));

  const month = dayjs().add(monthOffset, 'month');
  const monthStart = month.startOf('month');
  const monthEnd = month.endOf('month');

  const state = useAsync(
    async () => sessionsApi.calendar(monthStart.toISOString(), monthEnd.toISOString()),
    [monthOffset],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof state.data>();
    for (const entry of state.data ?? []) {
      const key = dayjs(entry.scheduledAt).format('YYYY-MM-DD');
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [state.data]);

  // Pad the grid so the 1st falls on its real weekday.
  const leadingBlanks = monthStart.day();
  const daysInMonth = month.daysInMonth();
  const cells: Array<string | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => monthStart.add(i, 'day').format('YYYY-MM-DD')),
  ];

  const selectedEntries = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.lg }}>
        <Pressable
          onPress={() => setMonthOffset((m) => m - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={10}
        >
          <Body style={{ color: t.colors.primary, fontWeight: '600' }}>‹ Prev</Body>
        </Pressable>
        <Title>{month.format('MMMM YYYY')}</Title>
        <Pressable
          onPress={() => setMonthOffset((m) => m + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={10}
        >
          <Body style={{ color: t.colors.primary, fontWeight: '600' }}>Next ›</Body>
        </Pressable>
      </Row>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      <Row style={{ marginBottom: t.spacing.sm }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
          <View key={`${label}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <Caption>{label}</Caption>
          </View>
        ))}
      </Row>

      {state.loading ? (
        <LoadingView />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((day, index) => {
            if (!day) return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, height: 46 }} />;

            const entries = byDay.get(day) ?? [];
            const isToday = day === dayjs().format('YYYY-MM-DD');
            const isSelected = day === selectedDay;

            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                accessibilityRole="button"
                accessibilityLabel={`${dayjs(day).format('D MMMM')}, ${entries.length} sessions`}
                style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected
                      ? t.colors.primary
                      : isToday
                        ? t.colors.primarySoft
                        : 'transparent',
                  }}
                >
                  <Body
                    small
                    style={{
                      color: isSelected
                        ? t.colors.textInverse
                        : isToday
                          ? t.colors.primary
                          : t.colors.text,
                      fontWeight: isToday || isSelected ? '700' : '400',
                    }}
                  >
                    {dayjs(day).date()}
                  </Body>
                </View>
                {entries.length > 0 ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      marginTop: 2,
                      backgroundColor: isSelected ? t.colors.primary : t.colors.success,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: t.spacing.xl }}>
        <SectionHeader
          title={selectedDay ? dayjs(selectedDay).format('dddd D MMMM') : 'Select a day'}
        />
        {selectedEntries.length === 0 ? (
          <EmptyState
            icon="calendar-clear-outline"
            title="Nothing on this day"
            message="Pick another day, or schedule a session with one of your connections."
          />
        ) : (
          selectedEntries.map((entry) => (
            <CalendarEntryCard
              key={entry.id}
              entry={entry}
              onPress={() => navigation.navigate('SessionDetails', { sessionId: entry.id })}
            />
          ))
        )}
      </View>
    </Screen>
  );
}
