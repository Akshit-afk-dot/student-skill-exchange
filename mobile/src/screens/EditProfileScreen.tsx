import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { uploads, users as usersApi } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Button,
  Caption,
  Chip,
  Field,
  Input,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '../components/ui';
import { useAction } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { WEEKDAY_NAMES, slotLabel } from '../utils/format';
import type { AvailabilitySlot, TeachingMode } from '../types';

const TIME_OPTIONS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

export function EditProfileScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();
  const { user, refreshUser, setUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [college, setCollege] = useState(user?.college ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [year, setYear] = useState(user?.year ? String(user.year) : '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [languages, setLanguages] = useState((user?.languages ?? []).join(', '));
  const [teachingMode, setTeachingMode] = useState<TeachingMode>(user?.teachingMode ?? 'BOTH');
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(user?.availability ?? []);
  const [avatarUri, setAvatarUri] = useState(user?.profileImage);

  // Draft state for the "add a slot" row.
  const [slotDay, setSlotDay] = useState(1);
  const [slotStart, setSlotStart] = useState('18:00');
  const [slotEnd, setSlotEnd] = useState('20:00');

  const save = useAction(async () => {
    const result = await usersApi.updateProfile({
      name: name.trim(),
      ...(college.trim() ? { college: college.trim() } : {}),
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(year ? { year: Number(year) } : {}),
      bio: bio.trim(),
      ...(city.trim() ? { city: city.trim() } : {}),
      languages: languages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 10),
      teachingMode,
      availability,
    });
    setUser(result.user);
    navigation.goBack();
    return result;
  });

  const uploadAvatar = useAction(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return null;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]) return null;

    const asset = picked.assets[0];
    const result = await uploads.avatar({
      uri: asset.uri,
      name: asset.fileName ?? 'avatar.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });

    setAvatarUri(result.url);
    await refreshUser();
    return result;
  });

  const detectLocation = useAction(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow location access so we can find students near you for in-person sessions.',
      );
      return null;
    }

    const position = await Location.getCurrentPositionAsync({});
    const result = await usersApi.updateLocation(
      position.coords.longitude,
      position.coords.latitude,
      city.trim() || undefined,
    );
    setUser(result.user);
    Alert.alert('Location saved', 'You will now show up in nearby searches.');
    return result;
  });

  function addSlot() {
    if (slotEnd <= slotStart) {
      Alert.alert('Check the times', 'The end time has to be after the start time.');
      return;
    }
    const duplicate = availability.some(
      (s) => s.day === slotDay && s.start === slotStart && s.end === slotEnd,
    );
    if (duplicate) return;
    setAvailability((prev) => [...prev, { day: slotDay, start: slotStart, end: slotEnd }]);
  }

  const anyError = save.error ?? uploadAvatar.error ?? detectLocation.error;

  return (
    <Screen scroll>
      <Title>Edit profile</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        A complete profile gets noticeably better matches.
      </Body>

      {anyError ? <Banner tone="danger" text={anyError} /> : null}

      <View style={{ alignItems: 'center', marginBottom: t.spacing.xl }}>
        <Pressable
          onPress={() => void uploadAvatar.run()}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <Avatar name={name || 'You'} uri={avatarUri} size={92} />
        </Pressable>
        <Pressable onPress={() => void uploadAvatar.run()} hitSlop={8}>
          <Body small style={{ color: t.colors.primary, fontWeight: '600', marginTop: t.spacing.sm }}>
            {uploadAvatar.pending ? 'Uploading…' : 'Change photo'}
          </Body>
        </Pressable>
      </View>

      <Field label="Name" error={save.fieldErrors?.name}>
        <Input value={name} onChangeText={setName} autoCapitalize="words" />
      </Field>

      <Field label="Bio" hint={`${bio.length}/1000`}>
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="What do you study, what are you good at, what are you trying to learn?"
          multiline
          numberOfLines={4}
          maxLength={1000}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
      </Field>

      <Field label="College">
        <Input value={college} onChangeText={setCollege} autoCapitalize="words" />
      </Field>

      <Field label="Department">
        <Input value={department} onChangeText={setDepartment} autoCapitalize="words" />
      </Field>

      <Field label="Year of study">
        <Row gap={t.spacing.sm}>
          {[1, 2, 3, 4, 5].map((y) => (
            <Chip
              key={y}
              label={String(y)}
              selected={year === String(y)}
              onPress={() => setYear(year === String(y) ? '' : String(y))}
            />
          ))}
        </Row>
      </Field>

      <Field label="Languages" hint="Comma separated, e.g. English, Hindi, Tamil">
        <Input value={languages} onChangeText={setLanguages} autoCapitalize="words" />
      </Field>

      <Field label="How do you prefer to meet?">
        <Row gap={t.spacing.sm}>
          <Chip
            label="Online only"
            selected={teachingMode === 'ONLINE'}
            onPress={() => setTeachingMode('ONLINE')}
          />
          <Chip
            label="In person only"
            selected={teachingMode === 'OFFLINE'}
            onPress={() => setTeachingMode('OFFLINE')}
          />
          <Chip label="Either" selected={teachingMode === 'BOTH'} onPress={() => setTeachingMode('BOTH')} />
        </Row>
      </Field>

      <Field label="City">
        <Input value={city} onChangeText={setCity} placeholder="Bengaluru" autoCapitalize="words" />
      </Field>

      <Button
        label={detectLocation.pending ? 'Getting location…' : 'Use my current location'}
        variant="secondary"
        icon="location-outline"
        onPress={() => void detectLocation.run()}
        loading={detectLocation.pending}
        style={{ marginBottom: t.spacing.xl }}
      />
      <Caption style={{ marginTop: -t.spacing.lg, marginBottom: t.spacing.xl }}>
        Only your city is shown to other students. Your coordinates are used to compute
        distance and are never shared.
      </Caption>

      <SectionHeader title="When are you usually free?" />
      <Caption style={{ marginBottom: t.spacing.md }}>
        Overlapping free time is 20% of your match score, so this is worth filling in.
      </Caption>

      {availability.length > 0 ? (
        <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap', marginBottom: t.spacing.md }}>
          {availability.map((slot, index) => (
            <Chip
              key={`${slot.day}-${slot.start}-${slot.end}-${index}`}
              label={`${slotLabel(slot)}  ✕`}
              tone="primary"
              onPress={() => setAvailability((prev) => prev.filter((_, i) => i !== index))}
            />
          ))}
        </Row>
      ) : null}

      <Field label="Day">
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {WEEKDAY_NAMES.map((label, day) => (
            <Chip
              key={label}
              label={label}
              selected={slotDay === day}
              onPress={() => setSlotDay(day)}
            />
          ))}
        </Row>
      </Field>

      <Field label="From">
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {TIME_OPTIONS.map((time) => (
            <Chip
              key={time}
              label={time}
              selected={slotStart === time}
              onPress={() => setSlotStart(time)}
            />
          ))}
        </Row>
      </Field>

      <Field label="Until">
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {TIME_OPTIONS.map((time) => (
            <Chip
              key={time}
              label={time}
              selected={slotEnd === time}
              onPress={() => setSlotEnd(time)}
            />
          ))}
        </Row>
      </Field>

      <Button
        label="Add this slot"
        variant="secondary"
        icon="add"
        onPress={addSlot}
        style={{ marginBottom: t.spacing.xl }}
      />

      <Button
        label="Save changes"
        onPress={() => void save.run()}
        loading={save.pending}
        disabled={name.trim().length < 2}
      />
      <View style={{ height: t.spacing.xl }} />
    </Screen>
  );
}
