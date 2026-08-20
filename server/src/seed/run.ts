/**
 * Demo data seeder.
 *
 * Populates a database with a realistic set of students, skills, connections, sessions
 * and reviews so the app can be demonstrated without clicking through every flow by
 * hand. Intended for development and demo environments only.
 *
 *   npm run seed            # add demo data, keeping anything already there
 *   npm run seed -- --reset # wipe the demo collections first
 */

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env, isProd } from '../config/env';
import { logger } from '../config/logger';
import {
  Connection,
  Conversation,
  LearningRequest,
  Message,
  Notification,
  Review,
  Session,
  Skill,
  User,
  UserSkill,
  hashPassword,
  pairKeyOf,
} from '../models';
import type { SkillLevel } from '../types/domain';
import { recalculateRating } from '../modules/users/service';
import { evaluateBadges } from '../modules/gamification/service';
import { ensureSeedData } from './bootstrap';

const DEMO_PASSWORD = 'Password123';

interface DemoStudent {
  name: string;
  email: string;
  college: string;
  department: string;
  year: number;
  bio: string;
  city: string;
  coordinates: [number, number];
  languages: string[];
  teaches: Array<[string, SkillLevel]>;
  learns: Array<[string, SkillLevel]>;
  availability: Array<[number, string, string]>;
}

/** Bengaluru-area colleges and coordinates, so the geo features have something to show. */
const STUDENTS: DemoStudent[] = [
  {
    name: 'Aarav Mehta',
    email: 'aarav@demo.college.edu',
    college: 'PES University',
    department: 'Computer Science',
    year: 3,
    bio: 'Full-stack developer who has been building React apps since first year. Happy to walk anyone through JavaScript fundamentals.',
    city: 'Bengaluru',
    coordinates: [77.5385, 12.9345],
    languages: ['English', 'Hindi', 'Gujarati'],
    teaches: [['JavaScript', 'ADVANCED'], ['React', 'ADVANCED'], ['Git', 'INTERMEDIATE']],
    learns: [['Figma', 'BEGINNER'], ['UI/UX Design', 'BEGINNER']],
    availability: [[1, '18:00', '21:00'], [3, '18:00', '21:00'], [6, '10:00', '14:00']],
  },
  {
    name: 'Priya Nair',
    email: 'priya@demo.college.edu',
    college: 'PES University',
    department: 'Design',
    year: 3,
    bio: 'Product designer. I run the design club and have shipped three app redesigns. Looking to finally learn to code properly.',
    city: 'Bengaluru',
    coordinates: [77.5385, 12.9345],
    languages: ['English', 'Malayalam', 'Hindi'],
    teaches: [['Figma', 'EXPERT'], ['UI/UX Design', 'ADVANCED'], ['Graphic Design', 'INTERMEDIATE']],
    learns: [['JavaScript', 'BEGINNER'], ['React', 'BEGINNER']],
    availability: [[1, '18:00', '21:00'], [3, '17:00', '20:00'], [6, '11:00', '15:00']],
  },
  {
    name: 'Rahul Sharma',
    email: 'rahul@demo.college.edu',
    college: 'RV College of Engineering',
    department: 'Computer Science',
    year: 4,
    bio: 'Competitive programmer, 5-star on CodeChef. I tutor data structures and algorithms most weekends.',
    city: 'Bengaluru',
    coordinates: [77.4985, 12.9237],
    languages: ['English', 'Hindi'],
    teaches: [
      ['Python', 'ADVANCED'],
      ['Data Structures', 'EXPERT'],
      ['Algorithms', 'EXPERT'],
      ['Competitive Programming', 'ADVANCED'],
    ],
    learns: [['Machine Learning', 'INTERMEDIATE'], ['Public Speaking', 'BEGINNER']],
    availability: [[0, '10:00', '13:00'], [6, '10:00', '13:00'], [2, '19:00', '21:00']],
  },
  {
    name: 'Ananya Iyer',
    email: 'ananya@demo.college.edu',
    college: 'RV College of Engineering',
    department: 'Information Science',
    year: 4,
    bio: 'ML research intern. Published a paper on transformer efficiency. Terrified of public speaking, working on it.',
    city: 'Bengaluru',
    coordinates: [77.4985, 12.9237],
    languages: ['English', 'Tamil'],
    teaches: [
      ['Machine Learning', 'ADVANCED'],
      ['Python', 'ADVANCED'],
      ['Statistics', 'INTERMEDIATE'],
    ],
    learns: [['Public Speaking', 'BEGINNER'], ['Guitar', 'BEGINNER']],
    availability: [[2, '19:00', '21:00'], [4, '19:00', '21:00'], [0, '10:00', '12:00']],
  },
  {
    name: 'Vikram Reddy',
    email: 'vikram@demo.college.edu',
    college: 'BMS College of Engineering',
    department: 'Electronics',
    year: 2,
    bio: 'Debate team captain and MUN regular. I can help you stop saying "um" every third word.',
    city: 'Bengaluru',
    coordinates: [77.5657, 12.9411],
    languages: ['English', 'Telugu', 'Hindi'],
    teaches: [
      ['Public Speaking', 'EXPERT'],
      ['Debate', 'ADVANCED'],
      ['Presentation Skills', 'ADVANCED'],
    ],
    learns: [['Python', 'BEGINNER'], ['Excel', 'INTERMEDIATE']],
    availability: [[1, '17:00', '19:00'], [4, '17:00', '20:00'], [5, '16:00', '19:00']],
  },
  {
    name: 'Sneha Kulkarni',
    email: 'sneha@demo.college.edu',
    college: 'BMS College of Engineering',
    department: 'Computer Science',
    year: 3,
    bio: 'Photographer for the college magazine. Also a decent Java programmer when the light is bad.',
    city: 'Bengaluru',
    coordinates: [77.5657, 12.9411],
    languages: ['English', 'Marathi', 'Kannada'],
    teaches: [
      ['Photography', 'ADVANCED'],
      ['Photo Editing', 'ADVANCED'],
      ['Java', 'INTERMEDIATE'],
    ],
    learns: [['Video Editing', 'BEGINNER'], ['React Native', 'BEGINNER']],
    availability: [[5, '16:00', '19:00'], [6, '09:00', '13:00']],
  },
  {
    name: 'Arjun Menon',
    email: 'arjun@demo.college.edu',
    college: 'PES University',
    department: 'Mechanical',
    year: 2,
    bio: 'Been playing guitar for eight years. Teaching it is how I pay for strings.',
    city: 'Bengaluru',
    coordinates: [77.5385, 12.9345],
    languages: ['English', 'Malayalam'],
    teaches: [['Guitar', 'EXPERT'], ['Music Production', 'INTERMEDIATE']],
    learns: [['Photography', 'BEGINNER'], ['Video Editing', 'BEGINNER']],
    availability: [[2, '18:00', '21:00'], [6, '14:00', '18:00']],
  },
  {
    name: 'Ishita Banerjee',
    email: 'ishita@demo.college.edu',
    college: 'Christ University',
    department: 'Commerce',
    year: 2,
    bio: 'Finance nerd. I explain the stock market without the jargon, and I want to learn to build a website.',
    city: 'Bengaluru',
    coordinates: [77.6033, 12.9345],
    languages: ['English', 'Bengali', 'Hindi'],
    teaches: [
      ['Stock Market Basics', 'ADVANCED'],
      ['Financial Literacy', 'ADVANCED'],
      ['Excel', 'EXPERT'],
    ],
    learns: [['JavaScript', 'BEGINNER'], ['Digital Marketing', 'INTERMEDIATE']],
    availability: [[1, '19:00', '21:00'], [3, '19:00', '21:00'], [0, '15:00', '18:00']],
  },
  {
    name: 'Karthik Rao',
    email: 'karthik@demo.college.edu',
    college: 'Christ University',
    department: 'Media Studies',
    year: 3,
    bio: 'I edit videos for three YouTube channels. Premiere Pro is my second language.',
    city: 'Bengaluru',
    coordinates: [77.6033, 12.9345],
    languages: ['English', 'Kannada'],
    teaches: [
      ['Video Editing', 'EXPERT'],
      ['Premiere Pro', 'ADVANCED'],
      ['Digital Marketing', 'INTERMEDIATE'],
    ],
    learns: [['Photography', 'INTERMEDIATE'], ['Graphic Design', 'BEGINNER']],
    availability: [[4, '18:00', '22:00'], [6, '12:00', '17:00']],
  },
  {
    name: 'Meera Joshi',
    email: 'meera@demo.college.edu',
    college: 'PES University',
    department: 'Computer Science',
    year: 1,
    bio: 'First year, still figuring things out. I speak four languages though, so I can help with those.',
    city: 'Bengaluru',
    coordinates: [77.5385, 12.9345],
    languages: ['English', 'Hindi', 'Marathi', 'German'],
    teaches: [['German', 'INTERMEDIATE'], ['Hindi', 'EXPERT']],
    learns: [
      ['Python', 'BEGINNER'],
      ['Data Structures', 'BEGINNER'],
      ['Public Speaking', 'BEGINNER'],
    ],
    availability: [[1, '16:00', '19:00'], [3, '16:00', '19:00'], [5, '15:00', '18:00']],
  },
];

/** Exchange pairs that get a full history: connection, sessions and reviews. */
const EXCHANGES: Array<{
  a: string;
  b: string;
  skillAtoB: string;
  skillBtoA: string;
  sessions: Array<{ daysAgo: number; minutes: number; ratingForA?: number; ratingForB?: number }>;
}> = [
  {
    a: 'aarav@demo.college.edu',
    b: 'priya@demo.college.edu',
    skillAtoB: 'JavaScript',
    skillBtoA: 'Figma',
    sessions: [
      { daysAgo: 21, minutes: 90, ratingForA: 5, ratingForB: 5 },
      { daysAgo: 14, minutes: 60, ratingForA: 5, ratingForB: 4 },
      { daysAgo: 7, minutes: 60, ratingForA: 4, ratingForB: 5 },
    ],
  },
  {
    a: 'rahul@demo.college.edu',
    b: 'ananya@demo.college.edu',
    skillAtoB: 'Data Structures',
    skillBtoA: 'Machine Learning',
    sessions: [
      { daysAgo: 18, minutes: 120, ratingForA: 5, ratingForB: 5 },
      { daysAgo: 10, minutes: 90, ratingForA: 5, ratingForB: 5 },
    ],
  },
  {
    a: 'vikram@demo.college.edu',
    b: 'meera@demo.college.edu',
    skillAtoB: 'Public Speaking',
    skillBtoA: 'German',
    sessions: [{ daysAgo: 5, minutes: 60, ratingForA: 5, ratingForB: 4 }],
  },
  {
    a: 'sneha@demo.college.edu',
    b: 'karthik@demo.college.edu',
    skillAtoB: 'Photography',
    skillBtoA: 'Video Editing',
    sessions: [{ daysAgo: 3, minutes: 90, ratingForA: 4, ratingForB: 5 }],
  },
];

async function resetDemoData(): Promise<void> {
  logger.warn('Clearing existing demo data');
  await Promise.all([
    User.deleteMany({ email: /@demo\.college\.edu$/ }),
    LearningRequest.deleteMany({}),
    Connection.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
  ]);
}

async function main(): Promise<void> {
  if (isProd) {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }

  await connectDatabase();
  await ensureSeedData();

  if (process.argv.includes('--reset')) await resetDemoData();

  const skills = await Skill.find().lean();
  const skillByName = new Map(skills.map((s) => [s.name.toLowerCase(), s._id]));

  const resolve = (name: string): mongoose.Types.ObjectId => {
    const id = skillByName.get(name.toLowerCase());
    if (!id) throw new Error(`Demo data references unknown skill "${name}"`);
    return id;
  };

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userByEmail = new Map<string, mongoose.Types.ObjectId>();

  for (const student of STUDENTS) {
    const existing = await User.findOne({ email: student.email });
    if (existing) {
      userByEmail.set(student.email, existing._id);
      continue;
    }

    const user = await User.create({
      name: student.name,
      email: student.email,
      passwordHash,
      college: student.college,
      department: student.department,
      year: student.year,
      bio: student.bio,
      city: student.city,
      location: { type: 'Point', coordinates: student.coordinates },
      languages: student.languages,
      emailVerified: true,
      teachingMode: 'BOTH',
      availability: student.availability.map(([day, start, end]) => ({ day, start, end })),
    });
    userByEmail.set(student.email, user._id);

    for (const [name, level] of student.teaches) {
      await UserSkill.create({ user: user._id, skill: resolve(name), type: 'TEACH', level });
      await Skill.updateOne({ _id: resolve(name) }, { $inc: { teachCount: 1 } });
    }
    for (const [name, level] of student.learns) {
      await UserSkill.create({
        user: user._id,
        skill: resolve(name),
        type: 'LEARN',
        level,
        priority: 2,
      });
      await Skill.updateOne({ _id: resolve(name) }, { $inc: { learnCount: 1 } });
    }
  }

  logger.info({ count: userByEmail.size }, 'Demo students ready');

  for (const exchange of EXCHANGES) {
    const aId = userByEmail.get(exchange.a);
    const bId = userByEmail.get(exchange.b);
    if (!aId || !bId) continue;

    const key = pairKeyOf(aId, bId);
    if (await Connection.exists({ pairKey: key })) continue;

    const request = await LearningRequest.create({
      sender: aId,
      receiver: bId,
      skill: resolve(exchange.skillBtoA),
      offeredSkill: resolve(exchange.skillAtoB),
      message: `Hi! I can teach you ${exchange.skillAtoB} if you can help me with ${exchange.skillBtoA}.`,
      status: 'ACCEPTED',
      respondedAt: new Date(),
    });

    const conversation = await Conversation.create({ pairKey: key, participants: [aId, bId] });
    const connection = await Connection.create({
      pairKey: key,
      participants: [aId, bId],
      originRequest: request._id,
      conversation: conversation._id,
      active: true,
    });
    conversation.connection = connection._id;
    await conversation.save();

    const chat = [
      { from: aId, to: bId, body: `Thanks for accepting! When works for you this week?` },
      { from: bId, to: aId, body: 'Wednesday evening after 6 is good for me. Online?' },
      { from: aId, to: bId, body: 'Perfect, I will send a meet link. Looking forward to it!' },
    ];
    let lastMessage = null;
    for (const [index, line] of chat.entries()) {
      lastMessage = await Message.create({
        conversation: conversation._id,
        sender: line.from,
        receiver: line.to,
        body: line.body,
        type: 'TEXT',
        deliveredAt: new Date(Date.now() - (chat.length - index) * 3600_000),
        readAt: new Date(),
      });
    }
    if (lastMessage) {
      conversation.lastMessage = lastMessage._id;
      conversation.lastMessageAt = lastMessage.createdAt;
      conversation.lastMessagePreview = lastMessage.body.slice(0, 200);
      await conversation.save();
    }

    for (const spec of exchange.sessions) {
      const scheduledAt = new Date(Date.now() - spec.daysAgo * 86_400_000);
      const session = await Session.create({
        teacher: bId,
        learner: aId,
        skill: resolve(exchange.skillBtoA),
        scheduledAt,
        durationMinutes: spec.minutes,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/demo-session',
        status: 'COMPLETED',
        completedBy: [aId, bId],
        completedAt: new Date(scheduledAt.getTime() + spec.minutes * 60_000),
        createdBy: aId,
      });

      await User.updateOne(
        { _id: bId },
        {
          $inc: {
            'stats.sessionsTaught': 1,
            'stats.minutesTaught': spec.minutes,
            'stats.points': 25,
          },
        },
      );
      await User.updateOne(
        { _id: aId },
        {
          $inc: {
            'stats.sessionsLearned': 1,
            'stats.minutesLearned': spec.minutes,
            'stats.points': 10,
          },
        },
      );

      if (spec.ratingForB !== undefined) {
        await Review.create({
          session: session._id,
          reviewer: aId,
          reviewee: bId,
          skill: session.skill,
          rating: spec.ratingForB,
          comment:
            spec.ratingForB >= 5
              ? 'Explained everything clearly and gave practical examples. Highly recommend.'
              : 'Good session, learned a lot. Would have liked more hands-on practice.',
        });
      }
      if (spec.ratingForA !== undefined) {
        await Review.create({
          session: session._id,
          reviewer: bId,
          reviewee: aId,
          skill: session.skill,
          rating: spec.ratingForA,
          comment: 'Came prepared with good questions and picked things up quickly.',
        });
      }
    }
  }

  // Add a couple of pending requests so the Requests screen is not empty.
  const meera = userByEmail.get('meera@demo.college.edu');
  const rahul = userByEmail.get('rahul@demo.college.edu');
  const ishita = userByEmail.get('ishita@demo.college.edu');
  const aarav = userByEmail.get('aarav@demo.college.edu');

  if (meera && rahul && !(await LearningRequest.exists({ sender: meera, receiver: rahul }))) {
    await LearningRequest.create({
      sender: meera,
      receiver: rahul,
      skill: resolve('Data Structures'),
      offeredSkill: resolve('German'),
      message:
        'Hi Rahul! I am struggling with linked lists and trees. I could help you with German in exchange?',
      status: 'PENDING',
    });
  }
  if (ishita && aarav && !(await LearningRequest.exists({ sender: ishita, receiver: aarav }))) {
    await LearningRequest.create({
      sender: ishita,
      receiver: aarav,
      skill: resolve('JavaScript'),
      offeredSkill: resolve('Excel'),
      message:
        'I want to build a small site for my finance blog. Happy to teach you advanced Excel in return!',
      status: 'PENDING',
    });
  }

  // Recompute the denormalised aggregates from the rows just written.
  for (const userId of userByEmail.values()) {
    await recalculateRating(userId);
    await evaluateBadges(userId);
  }

  const summary = {
    students: await User.countDocuments({ role: 'STUDENT' }),
    skills: await Skill.countDocuments(),
    connections: await Connection.countDocuments(),
    sessions: await Session.countDocuments(),
    reviews: await Review.countDocuments(),
    pendingRequests: await LearningRequest.countDocuments({ status: 'PENDING' }),
  };

  logger.info(summary, 'Demo data seeded');
  console.log(
    `\nDemo accounts are ready. Sign in with any of these and the password "${DEMO_PASSWORD}":\n` +
      STUDENTS.map((s) => `  ${s.email.padEnd(32)} ${s.name}`).join('\n') +
      (env.ADMIN_EMAIL ? `\n\nAdmin: ${env.ADMIN_EMAIL}\n` : '\n'),
  );

  await disconnectDatabase();
}

void main().catch((err) => {
  logger.fatal({ err }, 'Seeding failed');
  process.exit(1);
});
