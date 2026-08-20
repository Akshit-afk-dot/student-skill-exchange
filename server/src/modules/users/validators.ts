import { z } from 'zod';
import { SKILL_LEVELS, TEACHING_MODES } from '../../types/domain';

export const availabilitySlotSchema = z
  .object({
    day: z.coerce.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, e.g. 18:00'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, e.g. 20:00'),
  })
  .refine((s) => s.end > s.start, {
    message: 'End time must be after start time. Split overnight windows into two slots.',
    path: ['end'],
  });

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    college: z.string().trim().max(140).optional(),
    department: z.string().trim().max(140).optional(),
    year: z.coerce.number().int().min(1).max(8).optional(),
    bio: z.string().trim().max(1000).optional(),
    languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    teachingMode: z.enum(TEACHING_MODES).optional(),
    timezone: z.string().max(60).optional(),
    city: z.string().trim().max(120).optional(),
    availability: z.array(availabilitySlotSchema).max(40).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

export const updateLocationSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  city: z.string().trim().max(120).optional(),
});

/** Filters behind the Explore / Search Results screens. */
export const searchUsersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Skill id — restricts results to students who teach it. */
  skill: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid skill id').optional(),
  level: z
    .union([z.enum(SKILL_LEVELS), z.array(z.enum(SKILL_LEVELS))])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  college: z.string().trim().max(140).optional(),
  language: z.string().trim().max(40).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  mode: z.enum(TEACHING_MODES).optional(),
  onlineNow: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** Geo filter; both coordinates are required when either is present. */
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  radiusKm: z.coerce.number().positive().max(500).default(25),
  sort: z.enum(['relevance', 'rating', 'sessions', 'recent']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine(
  (v) => (v.longitude === undefined) === (v.latitude === undefined),
  { message: 'Provide both longitude and latitude, or neither', path: ['latitude'] },
);

export const objectIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id'),
});

export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
