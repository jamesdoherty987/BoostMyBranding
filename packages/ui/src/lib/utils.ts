/**
 * Aceternity + shadcn CLI expects a `cn` helper at `@/lib/utils`. Our
 * canonical implementation lives at `@/cn` — this file is a thin re-export
 * so primitives pasted or fetched from Aceternity resolve without edits.
 */
export { cn } from '../cn';
