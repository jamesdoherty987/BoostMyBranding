'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
  toast,
} from '@boost/ui';
import {
  Video,
  Sparkles,
  Play,
  ExternalLink,
  Film,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api } from '@/lib/dashboard/api';

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  usesImage: boolean;
  bestFor: readonly string[];
}

export default function VideosPage() {
  const { data: clients = [] } = useSWR('videos:clients', () => api.listClients());

  const { data: templates = [] } = useSWR('videos:templates', async () => {
    try {
      return (await api.listVideoTemplates()) as TemplateMeta[];
    } catch {
      return [] as TemplateMeta[];
    }
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('liquid-blob');
  const [clientId, setClientId] = useState<string>('');
  const [form, setForm] = useState({
    headline: 'Coffee, slowly.',
    subheadline: 'Small-batch · single origin',
    cta: 'Book a tasting',
    domain: 'verdecafe.com',
    imageUrl: '',
  });
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState<{ videoUrl: string; fromMock?: boolean } | null>(null);

  // Sync clientId once real clients load from the API. MUST be in an
  // effect — calling setState during render causes an infinite render loop
  // that crashes the page with "Cannot read properties of undefined".
  useEffect(() => {
    const firstId = clients[0]?.id;
    if (firstId && !clientId) {
      setClientId(firstId);
    }
  }, [clients, clientId]);

  const selected = templates.find((t) => t.id === selectedTemplate);
  const client = clients.find((c) => c.id === clientId);

  const render = async () => {
    if (!selectedTemplate || !clientId) {
      toast.error('Pick a template and client');
      return;
    }
    setRendering(true);
    setRendered(null);
    try {
      const result = await api.renderVideo({
        templateId: selectedTemplate,
        clientId,
        businessName: client?.businessName ?? 'Your Business',
        headline: form.headline,
        subheadline: form.subheadline || undefined,
        cta: form.cta || undefined,
        domain: form.domain || undefined,
        imageUrl: form.imageUrl || undefined,
        brand: client?.brandColors
          ? {
              primary: client.brandColors.primary,
              accent: client.brandColors.accent,
            }
          : undefined,
      });
      setRendered(result);
      toast.success(
        'Video rendered',
        result.fromMock ? 'Demo mode — add R2 keys to render real videos.' : 'Uploaded to R2.',
      );
    } catch (e) {
      toast.error('Render failed', (e as Error).message);
    } finally {
      setRendering(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Video Studio"
        subtitle="Render premium short-form videos for any client. Templates auto-fill with brand colors."
      />

      <div className="px-4 py-4 md:px-10 md:py-6 space-y-8">
        {/* Template picker */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Pick a template</h2>
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Film className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">
                  No templates available. Make sure the API is running.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t, i) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`relative overflow-hidden rounded-2xl border text-left transition-all ${
                    selectedTemplate === t.id
                      ? 'border-[#48D886] ring-2 ring-[#48D886]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="relative aspect-[9/16] overflow-hidden"
                    style={{
                      background: getPreviewBackground(t.id),
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="h-12 w-12 text-white/80" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/80">
                        <span>{(t.durationFrames / 30).toFixed(0)}s</span>
                        <span>·</span>
                        <span>{t.usesImage ? 'with image' : 'text only'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-3">
                    <div className="text-xs text-slate-500">{t.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Form + preview */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Video details</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Selected: <span className="font-semibold">{selected?.name ?? 'None'}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Headline *</label>
                <Input
                  className="mt-1"
                  value={form.headline}
                  onChange={(e) => setForm((s) => ({ ...s, headline: e.target.value }))}
                  placeholder="Coffee, slowly."
                  maxLength={80}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Subheadline</label>
                <Input
                  className="mt-1"
                  value={form.subheadline}
                  onChange={(e) => setForm((s) => ({ ...s, subheadline: e.target.value }))}
                  placeholder="Small-batch · single origin"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">CTA</label>
                  <Input
                    className="mt-1"
                    value={form.cta}
                    onChange={(e) => setForm((s) => ({ ...s, cta: e.target.value }))}
                    placeholder="Book a tasting"
                    maxLength={30}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Domain</label>
                  <Input
                    className="mt-1"
                    value={form.domain}
                    onChange={(e) => setForm((s) => ({ ...s, domain: e.target.value }))}
                    placeholder="verdecafe.com"
                    maxLength={60}
                  />
                </div>
              </div>

              {selected?.usesImage && (
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Image URL {selected.id === 'product-showcase' ? '(product shot with transparent background works best)' : '(full-bleed photo)'}
                  </label>
                  <Input
                    className="mt-1"
                    value={form.imageUrl}
                    onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500">
                  Rendering takes 10-30 seconds per video.
                </span>
                <Button onClick={render} disabled={rendering} size="lg">
                  {rendering ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  {rendering ? 'Rendering…' : 'Render video'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Video className="h-4 w-4 text-[#1D9CA1]" />
                  Preview
                </div>
                {rendered ? (
                  <div className="mt-4 space-y-3">
                    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-slate-900">
                      {rendered.fromMock ? (
                        <div className="flex h-full items-center justify-center p-6 text-center">
                          <div>
                            <Play className="mx-auto h-8 w-8 text-white/60" />
                            <p className="mt-2 text-xs text-white/60">
                              Mock mode — add R2 keys to see real rendered video
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* eslint-disable-next-line jsx-a11y/media-has-caption */
                        <video
                          src={rendered.videoUrl}
                          controls
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <a
                      href={rendered.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {rendered.videoUrl.slice(0, 40)}...
                    </a>
                  </div>
                ) : (
                  <div className="mt-4 flex aspect-[9/16] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                    <div className="text-center">
                      <Film className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-xs text-slate-400">No video yet</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-slate-900">Tips</h3>
                <ul className="mt-3 space-y-2 text-xs text-slate-600">
                  <li>• Keep the headline to 4-6 words for best fit</li>
                  <li>• Image templates need publicly accessible URLs</li>
                  <li>• Product Showcase works best with transparent-background shots</li>
                  <li>• Image Reveal wants a full-bleed photo that tells a story</li>
                  <li>• Brand colors are pulled from the client&apos;s record</li>
                </ul>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </>
  );
}

/** Generate a preview gradient background for each template card. */
function getPreviewBackground(templateId: string): string {
  switch (templateId) {
    case 'liquid-blob':
      return 'radial-gradient(circle at 30% 30%, #1D9CA1, #48D886 50%, #0B1220)';
    case 'product-showcase':
      return 'conic-gradient(from 0deg, #1D9CA1, #48D886, #FFEC3D, #1D9CA1)';
    case 'aurora':
      return 'conic-gradient(from 180deg at 50% 50%, #1D9CA1 0deg, transparent 90deg, #48D886 180deg, transparent 270deg, #FFEC3D 360deg)';
    case 'glitch-art':
      return 'linear-gradient(135deg, #FF00AA 0%, #0B1220 50%, #00FFFF 100%)';
    case 'holo-foil':
      return 'conic-gradient(from 45deg at 50% 50%, #1D9CA1, #48D886, #FFEC3D, #ff00ff, #1D9CA1)';
    default:
      return 'linear-gradient(135deg, #1D9CA1, #48D886)';
  }
}
