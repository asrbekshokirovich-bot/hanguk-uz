/**
 * The intake screen's answer lists.
 *
 * These are *stored values*, not display copy: what an operator picks here is
 * written to `leads` verbatim and later grouped and reported on. They are
 * therefore deliberately kept out of the i18n bundles — translating a stored
 * value would silently fork the reporting buckets the office already counts on.
 * Only the surrounding chrome (labels, errors, section titles) is translated.
 */

/** Cities offered in the intake form, in the order the design lists them. */
export const CITIES = [
  'Toshkent',
  'Samarqand',
  'Buxoro',
  'Andijon',
  "Farg'ona",
  'Namangan',
  'Qarshi',
  'Nukus',
  'Urganch',
  'Jizzax',
  'Navoiy',
  'Termiz',
  'Guliston',
] as const;

/** Language certificates. "Yo'q" is an answer, not a blank — see `isComplete`. */
export const CERTIFICATES = [
  "Yo'q",
  'TOPIK 1',
  'TOPIK 2',
  'TOPIK 3',
  'TOPIK 4',
  'TOPIK 5',
  'TOPIK 6',
  'IELTS 5.5',
  'IELTS 6.0',
  'IELTS 6.5',
  'IELTS 7.0+',
  'TOEFL',
] as const;

/** Study tracks. Stored in `education_level`. */
export const LEVELS = ['Kasbiy ta’lim', 'Bakalavr', 'Magistr', 'GKS'] as const;

/** How the lead reached us. Stored in `contact_channel`. */
export const CHANNELS = [
  'Instagram',
  'Telegram',
  'Telefon',
  'WhatsApp',
  'Ofisga keldi',
  'Sayt formasi',
] as const;

/** How the lead found us. Stored in `how_heard`. */
export const SOURCES = [
  'Ijtimoiy tarmoq reklamasi',
  'Instagram sahifasi',
  'Telegram kanali',
  'Do‘sti / tanishi tavsiyasi',
  'Tadbir yoki ko‘rgazma',
  'Google qidiruv',
  'YouTube / TikTok',
  'Boshqa',
] as const;

/**
 * Sources that mean nothing on their own. "A friend recommended us" is only
 * useful once you know *which* friend, so picking one of these reveals the
 * clarification field.
 */
export const SOURCES_NEEDING_NOTE: readonly string[] = [
  'Do‘sti / tanishi tavsiyasi',
  'Tadbir yoki ko‘rgazma',
  'Boshqa',
];

export const needsSourceNote = (source: string) => SOURCES_NEEDING_NOTE.includes(source);

/**
 * Intake semesters: the current year and the next, spring then autumn.
 *
 * Derived from the clock rather than hard-coded, so the list does not quietly
 * go stale in January. Stored in `target_intake`.
 */
export const semesterOptions = (now: Date = new Date()): string[] => {
  const year = now.getFullYear();
  return [`Bahorgi ${year}`, `Kuzgi ${year}`, `Bahorgi ${year + 1}`, `Kuzgi ${year + 1}`];
};

/** The age band the intake form accepts. The column allows a wider range. */
export const MIN_AGE = 15;
export const MAX_AGE = 45;

/** A phone number is considered dialable once it carries this many digits. */
export const MIN_PHONE_DIGITS = 9;
