import { describe, expect, it } from 'vitest';
import { skillMatchKey, skillSlug } from '../../src/models/Skill';
import { isBlockedSkillName } from '../../src/modules/skills/blocklist';
import { assessSkillName, tidySkillName, type NameProblem } from '../../src/modules/skills/quality';
import { CATEGORY_META, SKILL_CATALOG, catalogEntries } from '../../src/seed/catalog';
import { SKILL_CATEGORIES } from '../../src/types/domain';

/** Catalogue names too short for the new-skill rules. They are matched before the rules run. */
const SHORT_NAMES = new Set(['C', 'C++', 'C#', 'F#']);

/**
 * Every name the catalogue had before it grew. Renaming one would orphan the students
 * who listed it (see the rules at the top of catalog.ts), so they must all still be there.
 */
const ORIGINAL_NAMES = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C', 'React', 'React Native', 'Node.js',
  'Django', 'Flutter', 'Android Development', 'iOS Development', 'SQL', 'MongoDB', 'Git',
  'Data Structures', 'Algorithms', 'Machine Learning', 'Deep Learning', 'Data Science',
  'Cybersecurity', 'Cloud Computing', 'DevOps', 'Competitive Programming', 'UI/UX Design', 'Figma',
  'Adobe Photoshop', 'Adobe Illustrator', 'Graphic Design', 'Canva', 'Blender', '3D Modelling',
  'Motion Graphics', 'Video Editing', 'Premiere Pro', 'English', 'Hindi', 'Spanish', 'French',
  'German', 'Japanese', 'Korean', 'Mandarin', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Guitar',
  'Piano', 'Keyboard', 'Drums', 'Singing', 'Music Production', 'Violin', 'Flute', 'Photography',
  'Photo Editing', 'Lightroom', 'Portrait Photography', 'Videography', 'Entrepreneurship',
  'Digital Marketing', 'Financial Literacy', 'Stock Market Basics', 'Excel', 'Product Management',
  'Accounting', 'Mathematics', 'Calculus', 'Linear Algebra', 'Statistics', 'Physics', 'Chemistry',
  'Biology', 'Economics', 'Operating Systems', 'Computer Networks', 'Database Systems',
  'Public Speaking', 'Debate', 'Creative Writing', 'Technical Writing', 'Resume Building',
  'Interview Preparation', 'Presentation Skills', 'Cricket', 'Football', 'Badminton', 'Chess',
  'Basketball', 'Yoga', 'Table Tennis', 'Cooking', 'Sketching', 'Painting', 'Calligraphy',
  'Time Management', 'Note Taking',
];

/** Real skills students might add that the catalogue does not have. None may be refused. */
const REAL_CUSTOM_SKILLS = [
  'Bonsai', 'Kite Flying', 'Beekeeping', 'Juggling', 'Parkour', 'Fencing', 'Sailing',
  'Horse Riding', 'Kalaripayattu', 'Silambam', 'Yakshagana', 'Kathakali', 'Carnatic Violin',
  'Ghazal Singing', 'Qawwali', 'Beat Making', 'Latte Art', 'Mixology', 'Sourdough Baking',
  'South Indian Cooking', 'Macrame', 'Block Printing', 'Tie-Dye', 'Batik', 'Bookbinding',
  'Leathercraft', 'Model Rocketry', 'Ham Radio', 'Sudoku', 'Crossword Solving', 'Quizzing',
  'Esperanto', 'Swahili', 'Tulu', 'Bhojpuri', 'Elixir', 'Zig', 'OCaml', 'Julia', 'Fortran',
  'COBOL', 'Assembly Language', 'Verilog', 'VHDL', 'Webflow', 'WordPress', 'Shopify', 'Godot',
  'Three.js', 'D3.js', 'Socket.io', 'LaTeX', 'SPSS', 'Stata', 'Excel VBA', 'SAP', 'Salesforce',
  'ANSYS', 'CATIA', 'Revit', 'Rhino 3D', 'KiCad', 'PCB Design', '3D Printing', '8085 Microprocessor',
  'Windows 11 Troubleshooting', 'Web3 Development', 'Quantum Computing', 'Bioinformatics',
  'Hydroponics', 'Vermicomposting', 'Urban Sketching', 'Charcoal Drawing', 'Pencil Shading',
  'Caricature', 'Graffiti', 'Tattoo Design', 'Nail Art', 'Makeup Artistry', 'Hairstyling',
  'Mime', 'Puppetry', 'Ventriloquism', 'Improv', 'Spoken Word Poetry', 'Shayari', 'Haiku Writing',
  'Harmonica', 'Didgeridoo', 'Bagpipes', 'Accordion', 'Sarod', 'Santoor', 'Shehnai', 'Ghatam',
  'Kanjira', 'Nadaswaram', 'Thavil', 'Chenda', 'Cha-Cha', 'Kho Kho Coaching', "Rubik's Revenge",
  // Near misses for the blocklist: innocent names that contain a blocked word's letters.
  'Classical Dance', 'Analysis of Algorithms', 'Cocktail Making', 'Assamese Cooking',
  'Bath Bomb Making', 'Phishing Awareness', 'Drug Discovery', 'Shiitake Farming',
  'Dickens Literature', 'Grape Farming', 'Art Therapist Training', 'Scrabble', 'Sussex History',
  'Chutney Making', 'Bass Fishing',
];

/** Rubbish, and the reason each is refused. */
const REFUSED: Array<[string, NameProblem]> = [
  ['a', 'LENGTH'],
  ['!!!', 'LENGTH'],
  ['Advanced Quantum Field Theory For Absolutely Everyone', 'LENGTH'],
  ['www.mysite.com', 'CONTACT'],
  ['Call 98765 43210', 'CONTACT'],
  ['me@mail.com', 'CONTACT'],
  ['\u{1F600}\u{1F600}', 'CHARACTERS'],
  ['गिटार', 'CHARACTERS'],
  ['Guitar, piano', 'CHARACTERS'],
  ['asdfgh', 'GIBBERISH'],
  ['lkjhg', 'GIBBERISH'],
  ['as df gh', 'GIBBERISH'],
  ['hahaha', 'GIBBERISH'],
  ['aaaaaa', 'GIBBERISH'],
  ['xjkqzpt', 'GIBBERISH'],
  ['Brrrr', 'GIBBERISH'],
  ['x1', 'GIBBERISH'],
  ['test', 'PLACEHOLDER'],
  ['Testing', 'PLACEHOLDER'],
  ['anything', 'PLACEHOLDER'],
  ['n/a', 'PLACEHOLDER'],
  ['qwerty', 'PLACEHOLDER'],
  ['Music', 'TOO_GENERAL'],
  ['coding', 'TOO_GENERAL'],
  ['Dance', 'TOO_GENERAL'],
  ['I can teach anything', 'SENTENCE'],
  ['my hobbies', 'SENTENCE'],
  ['Teaching guitar', 'SENTENCE'],
  ['how to cook pasta', 'SENTENCE'],
  ['Guitar and piano and singing and drums', 'SENTENCE'],
  ['Sex', 'INAPPROPRIATE'],
  ['s3x', 'INAPPROPRIATE'],
  ['f u c k', 'INAPPROPRIATE'],
  ['Chutiya', 'INAPPROPRIATE'],
  ['Hacking Instagram', 'INAPPROPRIATE'],
  ['Weed Growing', 'INAPPROPRIATE'],
  ['Fake ID Making', 'INAPPROPRIATE'],
];

describe('skill names: tidying', () => {
  it.each([
    ['origami', 'Origami'],
    ['theory of computation', 'Theory of Computation'],
    ['hip-hop', 'Hip-Hop'],
    ['ui/ux design', 'Ui/Ux Design'],
    ['PAINTING', 'Painting'],
    ['SQL', 'SQL'],
    ['MATLAB', 'MATLAB'],
    ['iOS', 'iOS'],
    ['  guitar.  ', 'Guitar'],
    ['rubik’s   cube', "Rubik's Cube"],
    ['C++', 'C++'],
  ])('%s becomes %s', (raw, tidy) => {
    expect(tidySkillName(raw)).toBe(tidy);
  });
});

describe('skill names: the rules', () => {
  it.each(REAL_CUSTOM_SKILLS)('accepts %s', (name) => {
    const verdict = assessSkillName(name);
    expect(verdict).toEqual({ ok: true, name: expect.any(String) });
  });

  it.each(REFUSED)('refuses %s (%s)', (name, problem) => {
    const verdict = assessSkillName(name);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.problem).toBe(problem);
      expect(verdict.message.length).toBeGreaterThan(10);
    }
  });

  it('never repeats a blocked word back in its message', () => {
    const verdict = assessSkillName('Chutiya');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.message.toLowerCase()).not.toContain('chutiya');
  });

  it('matches blocked phrases only at the start', () => {
    expect(isBlockedSkillName('Bomb Making')).toBe(true);
    expect(isBlockedSkillName('Bath Bomb Making')).toBe(false);
  });
});

describe('skill slugs and match keys', () => {
  it('keeps C, C++ and C# apart', () => {
    expect(skillSlug('C')).toBe('c');
    expect(skillSlug('C++')).toBe('c-plus-plus');
    expect(skillSlug('C#')).toBe('c-sharp');
    expect(skillSlug('R&B')).toBe('r-and-b');
    expect(skillSlug('Español')).toBe('espanol');
  });

  it('treats spelling variants of one name as the same skill', () => {
    expect(skillMatchKey('NodeJS')).toBe(skillMatchKey('Node.js'));
    expect(skillMatchKey('node js')).toBe(skillMatchKey('Node.js'));
    expect(skillMatchKey('Guitars')).toBe(skillMatchKey('Guitar'));
    expect(skillMatchKey('Chess')).toBe('chess');
    expect(skillMatchKey('CSS')).toBe('css');
  });
});

describe('the seeded catalogue', () => {
  const entries = catalogEntries();

  it('still lists every original skill under its exact name', () => {
    const names = new Set(entries.map((e) => e.name));
    for (const name of ORIGINAL_NAMES) expect(names, name).toContain(name);
  });

  it('has names that pass the new-skill rules unchanged', () => {
    for (const { name } of entries) {
      if (SHORT_NAMES.has(name)) continue;
      expect(assessSkillName(name), name).toEqual({ ok: true, name });
    }
  });

  it('has no two entries sharing a slug, or a name or alias that means another entry', () => {
    const slugs = new Map<string, string>();
    const keys = new Map<string, string>();
    for (const { name, aliases } of entries) {
      const slug = skillSlug(name);
      expect(slugs.get(slug), `${name} and ${slugs.get(slug)} share the slug ${slug}`).toBeUndefined();
      slugs.set(slug, name);
      for (const key of new Set([name, ...aliases].map(skillMatchKey))) {
        expect(key, `${name} has an empty alias`).not.toBe('');
        expect(keys.get(key), `"${key}" means both ${name} and ${keys.get(key)}`).toBeUndefined();
        keys.set(key, name);
      }
    }
  });

  it('gives every category skills, an icon and a place, with Other last', () => {
    for (const category of SKILL_CATEGORIES) {
      expect(SKILL_CATALOG[category].length, category).toBeGreaterThanOrEqual(10);
      expect(CATEGORY_META.find((m) => m.name === category), category).toBeDefined();
    }
    const orders = CATEGORY_META.map((m) => m.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(CATEGORY_META.reduce((a, b) => (a.order > b.order ? a : b)).name).toBe('Other');
  });

  it('has grown well past the original hundred or so skills', () => {
    expect(entries.length).toBeGreaterThan(350);
  });
});
