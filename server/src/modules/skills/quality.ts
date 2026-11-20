import { isBlockedSkillName } from './blocklist';

/**
 * Whether a name a student typed can become a new skill, judged from the words alone.
 *
 * This is the first of three gates a new skill passes (see `checkSkillName` in the
 * service for the rest):
 *
 * 1. **The name itself** (this file): length, characters, links and phone numbers,
 *    sentences instead of names, placeholders ("test", "anything"), names too broad to
 *    match on ("Music"), keyboard mashing, and terms on the blocklist.
 * 2. **The catalogue**: a name that is already a skill, or one of its aliases, becomes that
 *    skill; a likely typo or a narrower wording of one ("Advanced Excel") is offered as
 *    "Did you mean…?"; a name moderators removed stays removed.
 * 3. **Review**: a new skill is usable by the students who list it straight away, but it
 *    joins the shared catalogue only when an admin approves it or enough students have
 *    added it independently.
 *
 * The rules here are deliberately conservative. A real skill that is wrongly refused is
 * a dead end for the student, while rubbish that slips through still has to pass review
 * before anyone else sees it. Every name in the seeded catalogue must pass, which the
 * unit tests check.
 */

export const SKILL_NAME_MIN = 2;
export const SKILL_NAME_MAX = 40;
const MAX_WORDS = 5;

export type NameProblem =
  | 'LENGTH'
  | 'CHARACTERS'
  | 'CONTACT'
  | 'SENTENCE'
  | 'PLACEHOLDER'
  | 'TOO_GENERAL'
  | 'GIBBERISH'
  | 'INAPPROPRIATE';

export type NameAssessment =
  | { ok: true; name: string }
  | { ok: false; problem: NameProblem; message: string };

/** Words that stay lower case inside a title, as in "Theory of Computation". */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/** Capitalises each word, and each part after a hyphen, slash or bracket ("Hip-Hop", "UI/UX"). */
function titleCase(name: string): string {
  return name
    .split(' ')
    .map((word, i) =>
      i > 0 && MINOR_WORDS.has(word)
        ? word
        : word.replace(/(^|[-/(])(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toUpperCase()),
    )
    .join(' ');
}

/**
 * The tidy form of a typed name: single spaces, straight apostrophes, no stray punctuation
 * at the ends, and title case when it was typed all in lower case or all in capitals.
 * Mixed case is the student's choice and is kept ("iOS", "PyTorch").
 */
export function tidySkillName(raw: string): string {
  let name = raw
    .normalize('NFKC')
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // "Guitar." or "- Chess", keeping the + and # that end "C++" and "C#".
    .replace(/^[\s.,;:!?'"\-/&]+|[\s.,;:!?'"\-/&]+$/g, '');

  const letters = name.replace(/[^\p{L}]/gu, '');
  if (letters && letters === letters.toLowerCase()) {
    name = titleCase(name);
  } else if (letters.length > 6 && letters === letters.toUpperCase()) {
    // Shouting, not an acronym: "PAINTING". Short capitals ("SQL", "MATLAB") are kept.
    name = titleCase(name.toLowerCase());
  }
  return name;
}

/** Whole names that are not a skill at all. Compared with letters only, lower case. */
const PLACEHOLDERS = new Set([
  'test', 'testing', 'tests', 'asdf', 'qwerty', 'none', 'nothing', 'anything', 'everything',
  'something', 'stuff', 'thing', 'things', 'idk', 'na', 'nil', 'null', 'undefined', 'skill',
  'skills', 'teach', 'learn', 'help', 'misc', 'other', 'others', 'general', 'all', 'any',
  'hello', 'hi', 'hey', 'lol', 'lmao', 'abc', 'abcd', 'xyz', 'random', 'whatever', 'etc',
  'no', 'yes', 'ok', 'okay', 'good', 'bad', 'nice', 'cool', 'demo', 'sample', 'example',
  'name', 'mine', 'myself', 'blah', 'foo', 'bar', 'baz', 'hobby', 'hobbies', 'talent',
  'talents', 'life', 'fun', 'time', 'nothingmuch', 'everythingelse', 'yourskill',
]);

/**
 * Whole names too broad to match two students on, each with a specific example to offer
 * instead. Catalogue skills are matched before these rules run, so a broad name that is
 * also a real catalogue entry ("Photography") is never refused.
 */
const TOO_GENERAL: Record<string, string> = {
  music: 'Guitar or Music Production',
  programming: 'Python or Web Development',
  coding: 'Python or Web Development',
  computer: 'Python or Excel',
  computers: 'Python or Excel',
  tech: 'Python or Cloud Computing',
  technology: 'Python or Cloud Computing',
  design: 'Graphic Design or Figma',
  art: 'Sketching or Watercolour Painting',
  arts: 'Sketching or Watercolour Painting',
  craft: 'Origami or Pottery',
  crafts: 'Origami or Pottery',
  sport: 'Badminton or Football',
  sports: 'Badminton or Football',
  games: 'Chess or Game Development',
  gaming: 'Chess or Esports',
  dance: 'Kathak or Hip Hop Dance',
  dancing: 'Kathak or Hip Hop Dance',
  fitness: 'Calisthenics or Yoga',
  health: 'Nutrition or First Aid',
  language: 'Spanish or Japanese',
  languages: 'Spanish or Japanese',
  science: 'Physics or Data Science',
  engineering: 'Thermodynamics or AutoCAD',
  studies: 'Calculus or Economics',
  study: 'Calculus or Economics',
  academics: 'Calculus or Economics',
  business: 'Digital Marketing or Accounting',
  communication: 'Public Speaking or Debate',
  writing: 'Creative Writing or Copywriting',
  editing: 'Video Editing or Photo Editing',
};

/** Keyboard rows, forwards and backwards, for spotting mashed keys ("asdf", "lkjh"). */
const KEYBOARD_RUNS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].flatMap((row) => [
  row,
  [...row].reverse().join(''),
]);

/** True when a single word looks like noise rather than language. */
function wordIsNoise(word: string, original: string): boolean {
  if (/(.)\1\1/.test(word)) return true; // "aaa", "hmmm"
  // A long word with no vowel ("sdfgh"). Capitals are left alone: they are acronyms.
  if (word.length >= 5 && !/[aeiouy]/.test(word) && original !== original.toUpperCase()) return true;
  if (/[^aeiouy]{6,}/.test(word)) return true; // "xjkqzpt"
  if (word.length >= 4 && KEYBOARD_RUNS.some((run) => run.includes(word))) return true;
  if (word.length >= 5 && new Set(word).size <= 2) return true; // "hahah", "lolol"
  return false;
}

/**
 * The same idea across the whole name with its spaces removed, for mashing split into
 * words ("as df gh", "ha ha ha"). Only the two tests that joining words cannot fake:
 * vowel and consonant runs would misfire on real pairs like "HTML CSS".
 */
function nameIsNoise(letters: string): boolean {
  if (letters.length >= 5 && KEYBOARD_RUNS.some((run) => run.includes(letters))) return true;
  return letters.length >= 6 && new Set(letters).size <= 2;
}

/** Checks a typed name against the rules above. Returns the tidy name when it passes. */
export function assessSkillName(raw: string): NameAssessment {
  const name = tidySkillName(raw);
  const fail = (problem: NameProblem, message: string): NameAssessment => ({ ok: false, problem, message });

  if (name.length < SKILL_NAME_MIN) return fail('LENGTH', 'Type the name of the skill.');
  if (name.length > SKILL_NAME_MAX) {
    return fail('LENGTH', `Keep it under ${SKILL_NAME_MAX} characters: just the skill's name, like "Watercolour Painting".`);
  }

  if (
    /@/.test(name) ||
    /https?:|www\.|\.(com|org|in|co|xyz|ly|gg)\b/i.test(name) ||
    /\d{5,}/.test(name.replace(/[\s\-.()]/g, ''))
  ) {
    return fail('CONTACT', 'Skill names can\'t contain links, emails or phone numbers.');
  }

  if (!/^[\p{L}\p{M}\d +#.&'/()-]+$/u.test(name)) {
    return fail('CHARACTERS', 'Use letters, numbers and simple punctuation only.');
  }
  const latinLetters = name.match(/[a-z]/gi)?.length ?? 0;
  if (latinLetters === 0) return fail('CHARACTERS', 'Write the skill\'s name in English letters, like "Kathak".');
  if (latinLetters < 2 || name.replace(/[\p{L}\s]/gu, '').length > latinLetters) {
    return fail('GIBBERISH', 'That doesn\'t look like a skill\'s name. Check the spelling.');
  }

  if (isBlockedSkillName(name)) return fail('INAPPROPRIATE', 'That isn\'t something we can list as a skill.');

  const lower = name.toLowerCase();
  if (name.split(' ').length > MAX_WORDS) {
    return fail('SENTENCE', 'Just the skill\'s name, not a sentence, like "Guitar" or "Public Speaking".');
  }
  if (/^(i|i'm|im|i've|ive|i'll|my|me|we|you|your|u)(?=\s|$)/.test(lower)) {
    return fail('SENTENCE', 'Just the skill\'s name, not a sentence, like "Guitar" or "Public Speaking".');
  }
  if (/^(teach|teaching|learn|learning|how to|help (with|me|you)|want to|wanna)(?=\s|$)/.test(lower)) {
    return fail('SENTENCE', 'Just the skill itself: "Guitar" rather than "Teaching guitar". You set your level below.');
  }

  const compact = lower.replace(/[^a-z]/g, '');
  if (PLACEHOLDERS.has(compact)) {
    return fail('PLACEHOLDER', 'That doesn\'t name a skill. Try something specific, like "Origami" or "Python".');
  }
  const broader = TOO_GENERAL[compact];
  if (broader) return fail('TOO_GENERAL', `"${name}" is too broad to match on. Name the skill itself, like ${broader}.`);

  const originals = name.split(/[^A-Za-z]+/).filter(Boolean);
  if (originals.some((word) => wordIsNoise(word.toLowerCase(), word)) || nameIsNoise(compact)) {
    return fail('GIBBERISH', 'That doesn\'t look like a skill\'s name. Check the spelling.');
  }

  return { ok: true, name };
}
