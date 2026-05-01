import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BoostMyBranding - Social media done for you';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Dynamic Open Graph image. Satori (what next/og uses) requires every node
 * that has multiple children to set `display: flex` — we adhere to that.
 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: 80,
          backgroundColor: '#ffffff',
          backgroundImage:
            'radial-gradient(80% 60% at 15% 15%, rgba(72,216,134,0.45), transparent 60%), radial-gradient(70% 60% at 85% 30%, rgba(29,156,161,0.45), transparent 60%), radial-gradient(60% 60% at 50% 110%, rgba(255,236,61,0.4), transparent 60%)',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#0B1220',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundImage: 'linear-gradient(135deg, #48D886, #1D9CA1 60%, #FFEC3D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 30,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, display: 'flex' }}>
            BoostMyBranding
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, maxWidth: 980, display: 'flex', flexDirection: 'column' }}>
            <span>Launch your brand.</span>
            <span
              style={{
                backgroundImage: 'linear-gradient(90deg, #1D9CA1, #48D886, #FFEC3D)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Watch it fly.
            </span>
          </div>
          <div style={{ fontSize: 28, color: '#475569', maxWidth: 820, display: 'flex' }}>
            A dedicated social team for modern local businesses. Thoughtful posts in your voice, planned and published every month.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            fontSize: 18,
            color: '#64748B',
            alignItems: 'center',
          }}
        >
          <span>boostmybranding.com</span>
          <span>·</span>
          <span>Instagram · Facebook · LinkedIn · TikTok · X · Bluesky · Pinterest</span>
        </div>
      </div>
    ),
    size,
  );
}
