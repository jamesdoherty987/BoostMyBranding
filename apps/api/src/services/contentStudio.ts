/**
 * ContentStudio wrapper. Schedules approved posts for publishing across
 * Instagram, Facebook, LinkedIn, TikTok, X, Pinterest, and Bluesky.
 *
 * Without CONTENTSTUDIO_API_KEY we return mock IDs so the downstream flow
 * still marks posts as scheduled.
 */

import { env, features } from '../env.js';

interface SchedulePostArgs {
  platform: string;
  caption: string;
  imageUrl?: string;
  scheduledAt: Date;
  workspaceId?: string;
}

export async function schedulePost(args: SchedulePostArgs): Promise<{ id: string }> {
  if (!features.contentStudio) {
    return { id: `cs_mock_${Date.now()}` };
  }

  const res = await fetch('https://api.contentstudio.io/v1/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CONTENTSTUDIO_API_KEY}`,
    },
    body: JSON.stringify({
      workspace_id: args.workspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID,
      platforms: [args.platform],
      content: { text: args.caption, media: args.imageUrl ? [args.imageUrl] : [] },
      schedule_at: args.scheduledAt.toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ContentStudio API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id: string };
  return { id: json.id };
}

export async function cancelPost(id: string) {
  if (!features.contentStudio) return;
  await fetch(`https://api.contentstudio.io/v1/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.CONTENTSTUDIO_API_KEY}` },
  });
}
