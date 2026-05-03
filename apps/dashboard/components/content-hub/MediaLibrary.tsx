'use client';

/**
 * Media Library — upload, keep, and delete images & videos for a single
 * client. Drag-to-drop, bulk-select, bulk-delete, and live progress bars.
 */

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import type { ClientImage } from '@boost/core';
import { Badge, Button, Spinner, toast, confirmDialog } from '@boost/ui';
import {
  Upload,
  Trash2,
  CheckSquare,
  Square,
  FileVideo,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import { api, API_URL } from '@/lib/api';

const IMAGE_EXT = /^image\//;
const VIDEO_EXT = /^video\//;

interface Props {
  clientId: string;
}

export function MediaLibrary({ clientId }: Props) {
  const { data = [], isLoading, mutate } = useSWR<ClientImage[]>(
    `media:${clientId}`,
    () => api.listImages(clientId).catch(() => []),
    { refreshInterval: 15000 },
  );

  const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items = data.filter((m) => {
    const mime = (m as any).mimeType ?? '';
    if (filter === 'images') return IMAGE_EXT.test(mime) || !mime;
    if (filter === 'videos') return VIDEO_EXT.test(mime);
    return true;
  });

  const imageCount = data.filter((m) => {
    const mime = (m as any).mimeType ?? '';
    return IMAGE_EXT.test(mime) || !mime;
  }).length;
  const videoCount = data.filter((m) => VIDEO_EXT.test((m as any).mimeType ?? '')).length;

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      setProgress(0);
      try {
        await api.uploadMediaWithProgress(clientId, files, [], setProgress);
        toast.success('Uploaded', `${files.length} file${files.length === 1 ? '' : 's'} saved`);
        mutate();
      } catch (e) {
        toast.error('Upload failed', (e as Error).message);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [clientId, mutate],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) upload(dropped);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((m) => m.id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (
      !(await confirmDialog({
        title: `Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`,
        description: 'This cannot be undone.',
        confirmLabel: `Delete ${selected.size}`,
        danger: true,
      }))
    )
      return;
    const ids = Array.from(selected);
    setSelected(new Set());
    // Optimistic UI
    mutate((prev) => prev?.filter((m) => !ids.includes(m.id)) ?? [], false);
    try {
      await Promise.all(ids.map((id) => api.deleteImage(id)));
      toast.success('Deleted', `${ids.length} file${ids.length === 1 ? '' : 's'} removed`);
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
    } finally {
      mutate();
    }
  };

  const deleteOne = async (id: string) => {
    if (
      !(await confirmDialog({
        title: 'Delete this file?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    mutate((prev) => prev?.filter((m) => m.id !== id) ?? [], false);
    try {
      await api.deleteImage(id);
      toast.success('Deleted');
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
      mutate();
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone + actions */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-[#48D886] bg-[#48D886]/5'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <Upload className="h-5 w-5 text-[#1D9CA1]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Drop photos or videos here</p>
          <p className="mt-0.5 text-xs text-slate-500">
            JPG, PNG, WEBP, GIF up to 15 MB · MP4, MOV, WEBM up to 100 MB
          </p>
        </div>
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner size={14} /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Choose files'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            upload(files);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-cta transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* Filter tabs + bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={chipClass(filter === 'all')}
        >
          All ({data.length})
        </button>
        <button
          onClick={() => setFilter('images')}
          className={chipClass(filter === 'images')}
        >
          <ImageIcon className="h-3 w-3" />
          Images ({imageCount})
        </button>
        <button
          onClick={() => setFilter('videos')}
          className={chipClass(filter === 'videos')}
        >
          <FileVideo className="h-3 w-3" />
          Videos ({videoCount})
        </button>

        <div className="ml-auto flex items-center gap-2">
          {items.length > 0 ? (
            <button
              onClick={selectAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {selected.size === items.length && items.length > 0 ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selected.size === items.length && items.length > 0 ? 'Unselect all' : 'Select all'}
            </button>
          ) : null}
          {selected.size > 0 ? (
            <Button size="sm" variant="outline" onClick={deleteSelected} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selected.size})
            </Button>
          ) : null}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <ImageIcon className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No media yet</p>
          <p className="text-xs text-slate-500">
            Upload photos or videos — they&apos;ll show up here tied to this client.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => {
            const isVideo = VIDEO_EXT.test((m as any).mimeType ?? '');
            const isSel = selected.has(m.id);
            return (
              <div
                key={m.id}
                className={`group relative overflow-hidden rounded-2xl border bg-white transition-all ${
                  isSel ? 'border-[#48D886] ring-2 ring-[#48D886]/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => toggleSelect(m.id)}
                  className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 shadow-sm backdrop-blur transition-opacity hover:bg-white"
                  aria-label={isSel ? 'Unselect' : 'Select'}
                >
                  {isSel ? (
                    <CheckSquare className="h-3.5 w-3.5 text-[#1D9CA1]" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>

                <button
                  onClick={() => deleteOne(m.id)}
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-rose-600 opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <div className="relative aspect-square bg-slate-100">
                  {isVideo ? (
                    /* eslint-disable-next-line jsx-a11y/media-has-caption */
                    <video
                      src={m.fileUrl}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      onMouseLeave={(e) => {
                        const v = e.currentTarget as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                  ) : (
                    <Image
                      src={(m as any).enhancedUrl ?? m.fileUrl}
                      alt={m.fileName ?? ''}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>

                <div className="flex items-center gap-1.5 p-2 text-[10px]">
                  {isVideo ? (
                    <Badge tone="brand">
                      <FileVideo className="h-2.5 w-2.5" />
                      Video
                    </Badge>
                  ) : m.qualityScore ? (
                    <Badge tone={m.qualityScore >= 7 ? 'success' : m.qualityScore >= 5 ? 'warning' : 'danger'}>
                      {m.qualityScore}/10
                    </Badge>
                  ) : m.status === 'pending' ? (
                    <Badge tone="default">Analyzing…</Badge>
                  ) : null}
                  {m.status === 'rejected' ? (
                    <Badge tone="danger">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Low quality
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return [
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
    active
      ? 'bg-slate-900 text-white'
      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200',
  ].join(' ');
}
