/**
 * Web research helper for personal content scripts.
 *
 * Gives Claude a grounded picture of the current world for news, sports,
 * gaming, and AI themes — so scripts reference actual recent events, not
 * LLM hallucinations. Pulls from Google News RSS + Wikipedia summaries.
 *
 * Cheap, fast, no paid APIs. Results are cached by the scraper service.
 */

import { searchGoogleNews, searchWikipediaImages } from './personalScraper.js';

export interface ResearchBundle {
  query: string;
  headlines: Array<{ title: string; source: string; url?: string; summary?: string }>;
  background?: string;
  gatheredAt: string;
}

/**
 * Research a topic and return a tidy context block the script-writer
 * can paste into its prompt. Never throws — missing signals just mean
 * the background section is shorter.
 */
export async function researchTopic(query: string): Promise<ResearchBundle> {
  const [headlines, wiki] = await Promise.all([
    searchGoogleNews(query, 8).catch(() => []),
    fetchWikipediaSummary(query).catch(() => undefined),
  ]);

  return {
    query,
    headlines: headlines.slice(0, 6).map((h) => ({
      title: h.title ?? 'Untitled',
      source: h.attribution ?? 'source',
      url: h.creditUrl,
      summary: h.description,
    })),
    background: wiki,
    gatheredAt: new Date().toISOString(),
  };
}

/**
 * Format a research bundle as a Claude-prompt-friendly block.
 * Scripts call this to inject grounded context under a clear heading.
 */
export function researchToPromptBlock(bundle: ResearchBundle): string {
  const parts: string[] = [];
  if (bundle.headlines.length > 0) {
    parts.push('RECENT HEADLINES (use these for factual grounding — never invent details beyond what is stated here):');
    for (const h of bundle.headlines) {
      parts.push(`- ${h.title} (${h.source})${h.summary ? `: ${h.summary}` : ''}`);
    }
  }
  if (bundle.background) {
    parts.push('\nBACKGROUND (from Wikipedia):');
    parts.push(bundle.background.slice(0, 800));
  }
  return parts.join('\n');
}

async function fetchWikipediaSummary(query: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'BoostBot/1.0' } },
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { extract?: string };
    return body.extract;
  } catch {
    return undefined;
  }
}
