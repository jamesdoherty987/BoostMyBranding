'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Aceternity github-globe wrapper, configured with our brand palette.
 *
 * Loaded dynamically with `ssr: false` because three.js touches `window`
 * during module init. We import from the `@boost/ui/globe` subpath so
 * three.js never lands in the main bundle graph (importing from the root
 * `@boost/ui` barrel would re-export the globe module and pull three.js
 * server-side, crashing static prerender).
 *
 * We render a set of arcs hopping between local hubs to reinforce the
 * "small, local team" story rather than the usual "global enterprise"
 * vibe. Arcs are short, regional, and slow.
 */

const GithubGlobe = dynamic(
  () => import('@boost/ui/globe').then((m) => m.World),
  {
    ssr: false,
    // Placeholder while three.js + the globe chunk load. The Statement
    // section's own gradient backdrop is already doing most of the
    // visual work — this adds a faint atmospheric halo so the spot
    // doesn't feel empty for the ~1s chunk download.
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="h-3/4 w-3/4 max-h-[600px] max-w-[600px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(72,216,134,0.5), rgba(29,156,161,0.3) 50%, transparent 75%)',
          }}
        />
      </div>
    ),
  },
) as unknown as React.ComponentType<{
  data: Arc[];
  globeConfig: Record<string, unknown>;
}>;

/* Brand palette — kept in sync with theme.ts */
const BRAND = {
  teal: '#1D9CA1',
  green: '#48D886',
  yellow: '#FFEC3D',
};

const ARC_COLORS = [BRAND.teal, BRAND.green, BRAND.yellow];

/**
 * Local clusters: a handful of cities grouped by region. Arcs are drawn
 * between cities within the same cluster so they look like "local" hops
 * rather than long-haul routes.
 */
const CLUSTERS: Array<Array<{ lat: number; lng: number }>> = [
  // UK + Ireland
  [
    { lat: 51.5074, lng: -0.1278 }, // London
    { lat: 53.4808, lng: -2.2426 }, // Manchester
    { lat: 55.9533, lng: -3.1883 }, // Edinburgh
    { lat: 53.3498, lng: -6.2603 }, // Dublin
    { lat: 52.4862, lng: -1.8904 }, // Birmingham
  ],
  // North America east
  [
    { lat: 40.7128, lng: -74.006 }, // New York
    { lat: 42.3601, lng: -71.0589 }, // Boston
    { lat: 39.9526, lng: -75.1652 }, // Philadelphia
    { lat: 43.6532, lng: -79.3832 }, // Toronto
    { lat: 45.5017, lng: -73.5673 }, // Montreal
  ],
  // North America west
  [
    { lat: 34.0522, lng: -118.2437 }, // LA
    { lat: 37.7749, lng: -122.4194 }, // SF
    { lat: 47.6062, lng: -122.3321 }, // Seattle
    { lat: 49.2827, lng: -123.1207 }, // Vancouver
  ],
  // Western Europe
  [
    { lat: 48.8566, lng: 2.3522 }, // Paris
    { lat: 52.52, lng: 13.405 }, // Berlin
    { lat: 52.3676, lng: 4.9041 }, // Amsterdam
    { lat: 50.8503, lng: 4.3517 }, // Brussels
    { lat: 41.3851, lng: 2.1734 }, // Barcelona
  ],
  // Aus + NZ
  [
    { lat: -33.8688, lng: 151.2093 }, // Sydney
    { lat: -37.8136, lng: 144.9631 }, // Melbourne
    { lat: -27.4698, lng: 153.0251 }, // Brisbane
    { lat: -36.8485, lng: 174.7633 }, // Auckland
  ],
];

interface Arc {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
}

/**
 * Build a list of short regional arcs from the clusters. Each cluster
 * contributes a ring of connections between its cities. `arcAlt` stays
 * low so arcs hug the globe, reading as short regional hops.
 */
function buildArcs(): Arc[] {
  const arcs: Arc[] = [];
  let order = 1;
  CLUSTERS.forEach((cluster, clusterIdx) => {
    for (let i = 0; i < cluster.length; i++) {
      const a = cluster[i]!;
      const b = cluster[(i + 1) % cluster.length]!;
      arcs.push({
        order: order++,
        startLat: a.lat,
        startLng: a.lng,
        endLat: b.lat,
        endLng: b.lng,
        // Low arc altitude so they read as short, local hops.
        arcAlt: 0.12 + ((clusterIdx + i) % 3) * 0.05,
        color: ARC_COLORS[(clusterIdx + i) % ARC_COLORS.length]!,
      });
    }
  });
  return arcs;
}

const GLOBE_CONFIG = {
  pointSize: 2,
  globeColor: '#0b2540',
  showAtmosphere: true,
  atmosphereColor: '#48D886',
  atmosphereAltitude: 0.14,
  emissive: '#062132',
  emissiveIntensity: 0.1,
  shininess: 0.9,
  polygonColor: 'rgba(255,255,255,0.55)',
  ambientLight: '#48D886',
  directionalLeftLight: '#ffffff',
  directionalTopLight: '#ffffff',
  pointLight: '#1D9CA1',
  arcTime: 2000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 20, lng: 0 },
  autoRotate: true,
  autoRotateSpeed: 0.4,
};

/**
 * Background globe used behind dark sections. Pointer-events disabled so
 * it doesn't intercept scrolls or clicks. The parent controls size.
 */
export function BrandGlobe({ className }: { className?: string }) {
  const arcs = useMemo(buildArcs, []);
  const reduced = useReducedMotion();

  const config = useMemo(
    () => ({
      ...GLOBE_CONFIG,
      autoRotate: !reduced,
      autoRotateSpeed: reduced ? 0 : GLOBE_CONFIG.autoRotateSpeed,
    }),
    [reduced],
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
    >
      <GithubGlobe data={arcs} globeConfig={config} />
    </div>
  );
}
