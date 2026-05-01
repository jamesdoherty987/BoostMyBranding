/**
 * Seed a freshly migrated database with a demo agency admin plus the three
 * demo clients and content so dashboard/portal work right away.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb, clients, users, posts, messages } from './index';

async function main() {
  const db = getDb();

  console.log('🌱 Seeding demo data…');

  const agencyAdminId = randomUUID();
  await db
    .insert(users)
    .values({
      id: agencyAdminId,
      email: 'admin@boostmybranding.com',
      name: 'Jamie Harris',
      role: 'agency_admin',
    })
    .onConflictDoNothing();

  const demoClients = [
    {
      businessName: "Murphy's Plumbing",
      contactName: 'Sean Murphy',
      email: 'sean@murphysplumbing.ie',
      industry: 'Home Services',
      subscriptionTier: 'full_package' as const,
      monthlyPriceCents: 80000,
      brandColors: { primary: '#0EA5E9', secondary: '#0B1220', accent: '#F59E0B' },
    },
    {
      businessName: 'Atlas Fitness',
      contactName: 'Nora Kelly',
      email: 'nora@atlasfitness.co',
      industry: 'Health & Fitness',
      subscriptionTier: 'social_only' as const,
      monthlyPriceCents: 70000,
      brandColors: { primary: '#EF4444', secondary: '#111827', accent: '#FBBF24' },
    },
    {
      businessName: 'Verde Cafe',
      contactName: 'Luca Romano',
      email: 'luca@verdecafe.com',
      industry: 'Food & Beverage',
      subscriptionTier: 'full_package' as const,
      monthlyPriceCents: 80000,
      brandColors: { primary: '#22C55E', secondary: '#1F2937', accent: '#F97316' },
    },
  ];

  for (const c of demoClients) {
    const [row] = await db.insert(clients).values(c).onConflictDoNothing().returning();
    if (!row) continue;
    await db.insert(users).values({
      email: c.email,
      name: c.contactName,
      role: 'client',
      clientId: row.id,
    }).onConflictDoNothing();
    // Seed a handful of pending posts
    for (let i = 0; i < 6; i++) {
      await db.insert(posts).values({
        clientId: row.id,
        caption: sampleCaptions[i % sampleCaptions.length]!,
        platform: platforms[i % platforms.length]!,
        hashtags: ['#smallbusiness', `#${c.industry.toLowerCase().replace(/\s+/g, '')}`],
        generatedImageUrl: `https://picsum.photos/seed/${row.id}-${i}/1024/1024`,
        scheduledAt: new Date(Date.now() + (i + 1) * 86400000),
        status: i < 4 ? 'pending_approval' : 'scheduled',
      });
    }
    await db.insert(messages).values({
      clientId: row.id,
      sender: 'agency',
      senderName: 'Jamie (BoostMyBranding)',
      body: 'Welcome aboard! Upload 10-15 photos to kick off your first batch.',
    });
  }

  console.log('✅ Seed complete');
  await closeDb();
}

const sampleCaptions = [
  'Morning routines built different ☕️ Drop your go-to below.',
  'Behind every reliable service is a team that shows up. Meet the crew.',
  "Small details, big impact. Here's what we shipped this week.",
  'Steam, smiles, and specialty beans. Weekend plans sorted.',
  'Before vs after — the glow-up nobody talks about.',
  '5-star review of the week 💛 Thanks for trusting us.',
];

const platforms = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x'] as const;

main().catch((e) => {
  console.error('❌ Seed failed', e);
  process.exit(1);
});
