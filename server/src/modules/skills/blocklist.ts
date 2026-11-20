/**
 * Terms a skill name may not contain: profanity and slurs (English and Hindi), sexual
 * content, drugs, and ways of harming or cheating people. The app's terms promise "no
 * tolerance for abusive behaviour or objectionable content", and a skill name is shown
 * to other students on profiles and in search.
 *
 * Tuned for skill names, not for chat: short words that hide inside innocent ones ("ass"
 * in "Class", "anal" in "Analysis", "sex" in "Sussex", "cock" in "Cocktail") only match
 * as whole words, and so does "rapist", which hides in "therapist". Only terms that never
 * occur inside a real word match anywhere.
 *
 * Text is lower-cased, accents are folded and common digit swaps are undone ("s3x" is
 * "sex") before matching. See `isBlockedSkillName`.
 */

/** Blocked wherever they occur, even inside a longer word or spelled out ("f u c k"). */
export const BLOCKED_ANYWHERE: readonly string[] = [
  'fuck',
  'motherf',
  'nigger',
  'nigga',
  'faggot',
  'porn',
  'pedophil',
  'paedophil',
  'sextortion',
  'onlyfans',
  'chutiya',
  'chutia',
  'madarchod',
  'maderchod',
  'behenchod',
  'bhenchod',
  'bhosdi',
  'bhosda',
  'gaandu',
];

/** Blocked as whole words only. */
export const BLOCKED_WORDS: ReadonlySet<string> = new Set([
  // Profanity
  'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'bastard', 'asshole', 'ass', 'arse',
  'arsehole', 'dick', 'dickhead', 'cock', 'cocks', 'pussy', 'cunt', 'twat', 'wanker',
  'slut', 'sluts', 'whore', 'whores',
  // Sexual content
  'sex', 'sexy', 'sexting', 'nude', 'nudes', 'naked', 'nsfw', 'xxx', 'escort', 'escorts',
  'escorting', 'hooker', 'prostitute', 'prostitution', 'hookup', 'hookups', 'horny',
  'boob', 'boobs', 'tits', 'titties', 'penis', 'vagina', 'cum', 'anal', 'orgasm',
  'masturbate', 'masturbation', 'fetish', 'bdsm',
  // Violence and abuse
  'rape', 'raping', 'rapist', 'rapists', 'molest', 'molesting', 'incest', 'pedo', 'paedo',
  // Slurs
  'retard', 'retarded', 'tranny', 'chink', 'spic', 'kike', 'paki', 'fag', 'dyke',
  'chamar', 'bhangi', 'chakka',
  // Hindi profanity
  'gandu', 'gaand', 'lund', 'lauda', 'loda', 'lavda', 'lawda', 'lavde', 'lawde', 'chut',
  'chodu', 'chod', 'bhosdike', 'bsdk', 'mkc', 'tmkc', 'harami', 'haramkhor', 'kamina',
  'kamine', 'kutiya', 'randi', 'randwa',
  // Drugs
  'cocaine', 'heroin', 'meth', 'methamphetamine', 'mdma', 'lsd', 'weed', 'ganja', 'charas',
  'hashish', 'marijuana', 'cannabis', 'opium',
  // Fraud and harassment
  'carding', 'scamming', 'doxxing', 'doxing', 'swatting',
]);

/**
 * Blocked when the name starts with them ("Hacking Instagram Accounts"), so "Bath Bomb
 * Making" and "Ethical Hacking" stay fine.
 */
export const BLOCKED_PHRASES: readonly string[] = [
  'drug dealing',
  'dealing drugs',
  'selling drugs',
  'bomb making',
  'making bombs',
  'making a bomb',
  'hack instagram',
  'hacking instagram',
  'instagram hacking',
  'hack facebook',
  'hacking facebook',
  'facebook hacking',
  'hack whatsapp',
  'hacking whatsapp',
  'whatsapp hacking',
  'hack accounts',
  'hacking accounts',
  'account hacking',
  'fake id',
  'fake ids',
  'fake documents',
  'fake certificates',
  'exam cheating',
  'cheating in exams',
  'proxy attendance',
];

/** Digit and symbol swaps used to dodge filters ("s3x", "@ss"). */
const SWAPS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/** True if the name contains a blocked term. */
export function isBlockedSkillName(name: string): boolean {
  const words = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => SWAPS[c] ?? c)
    .split(/[^a-z]+/)
    .filter(Boolean);

  if (words.some((word) => BLOCKED_WORDS.has(word))) return true;

  const joined = words.join('');
  if (BLOCKED_ANYWHERE.some((term) => joined.includes(term))) return true;

  const phrase = `${words.join(' ')} `;
  return BLOCKED_PHRASES.some((term) => phrase.startsWith(`${term} `));
}
