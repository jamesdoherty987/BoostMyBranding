/**
 * When personal videos are pushed to ContentStudio after render.
 */

import type { personalAccounts } from '@boost/database';
import { env, features } from '../env.js';

export type PersonalAccountRow = typeof personalAccounts.$inferSelect;

export function hasResolvableContentStudioWorkspace(account: PersonalAccountRow): boolean {
  const ws = (account.contentStudioWorkspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID ?? '').trim();
  return Boolean(ws);
}

/**
 * True when we should call ContentStudio after a successful render.
 * - `scheduleToContentStudio` on the generate request: one-off "Generate & schedule post"
 *   (still requires API key + a resolvable workspace).
 * - Otherwise: `account.autoSchedule` must be true (Posting tab: "Send to Content Studio"),
 *   then (auto-approve OR a pinned ContentStudio account id) so linked social
 *   accounts can post even when review stays on.
 */
export function shouldSchedulePersonalToContentStudio(
  args: {
    autoSchedule?: boolean;
    scheduleToContentStudio?: boolean;
    scheduledAt?: string;
  },
  account: PersonalAccountRow,
): boolean {
  if (!features.contentStudio || !hasResolvableContentStudioWorkspace(account)) {
    return false;
  }
  if (args.scheduleToContentStudio === true) {
    return true;
  }
  const auto = args.autoSchedule ?? account.autoSchedule;
  if (!auto) return false;
  const pinned = Boolean(account.contentStudioAccountId?.trim());
  return account.autoApprove || pinned;
}

/** When set, schedulePost uses this ContentStudio account id instead of auto-pick. */
export function contentStudioAccountIdsOverride(account: PersonalAccountRow): string[] | undefined {
  const id = account.contentStudioAccountId?.trim();
  return id ? [id] : undefined;
}
