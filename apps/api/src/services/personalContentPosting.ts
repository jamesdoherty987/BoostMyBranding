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
 * - `scheduleToContentStudio` on the generate request: one-off "generate & post"
 *   (still requires API key + a workspace id on env or this account).
 * - Otherwise: legacy behaviour — both account.autoSchedule and account.autoApprove.
 */
export function shouldSchedulePersonalToContentStudio(
  args: {
    autoSchedule?: boolean;
    scheduleToContentStudio?: boolean;
    scheduledAt?: string;
  },
  account: PersonalAccountRow,
): boolean {
  if (args.scheduleToContentStudio === true) {
    return Boolean(features.contentStudio && hasResolvableContentStudioWorkspace(account));
  }
  return (args.autoSchedule ?? account.autoSchedule) && account.autoApprove;
}

/** When set, schedulePost uses this ContentStudio account id instead of auto-pick. */
export function contentStudioAccountIdsOverride(account: PersonalAccountRow): string[] | undefined {
  const id = account.contentStudioAccountId?.trim();
  return id ? [id] : undefined;
}
