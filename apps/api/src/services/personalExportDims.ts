/**
 * Pixel dimensions for stitched personal video export.
 * Must stay in sync with the FFmpeg canvas in `personalStitcher.ts`.
 */
export type PersonalExportAspectRatio = '9:16' | '1:1' | '16:9' | '4:5';

export function exportDimsFor(
  ar: PersonalExportAspectRatio,
): { width: number; height: number } {
  switch (ar) {
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '9:16':
    default:
      return { width: 1080, height: 1920 };
  }
}
