import type { PersonalAccountStyleBible } from '@boost/database';

const ERR_PREFIX = 'EXAMPLE_TITLES_REQUIRED';

/** Non-empty example title lines from the account style bible (UI). */
export function countTrimmedExampleVideoTitles(
  styleBible: PersonalAccountStyleBible | null | undefined,
): number {
  return (styleBible?.exampleVideoTitles ?? []).map((t) => String(t).trim()).filter(Boolean).length;
}

/**
 * Personal **video** posts must ship with pattern-matched headlines from
 * {@link channelVideoTitleLikeIsolatedTest} (same as `pnpm test:isolated-channel-title`), which requires at least one operator-saved
 * example title. Slideshow / static_image channels are exempt.
 */
export function personalVideoRequiresExampleTitles(formatKind: string | null | undefined): boolean {
  return (formatKind ?? 'video') === 'video';
}

export function assertPersonalVideoExampleTitlesOrThrow(
  formatKind: string | null | undefined,
  styleBible: PersonalAccountStyleBible | null | undefined,
): void {
  if (!personalVideoRequiresExampleTitles(formatKind)) return;
  if (countTrimmedExampleVideoTitles(styleBible) >= 1) return;
  throw new Error(
    `${ERR_PREFIX}: Add at least one example video title under Style & config for this channel before generating.`,
  );
}

export function isExampleTitlesRequiredError(message: string): boolean {
  return message.includes(ERR_PREFIX);
}
