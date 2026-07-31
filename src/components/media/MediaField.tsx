'use client';

import { useAdminUiSafe } from '@/components/admin/ui/AdminUiProvider';

import MediaLibraryModal from '@/components/media/MediaLibraryModal';
import { deleteUploadedFile, uploadSingleFile } from '@/lib/client-upload';
import Image from 'next/image';
import { useState } from 'react';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;

  pathSegments: string[];
  itemName: string;

  label?: string;
  modalTitle?: string;
  accept?: string;
}

function getFileKind(url: string | null): 'image' | 'video' | 'unknown' {
  if (!url) return 'unknown';

  const clean = url.split('?')[0].toLowerCase();

  if (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.avif')
  ) {
    return 'image';
  }

  if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov')) {
    return 'video';
  }

  return 'unknown';
}

export default function MediaField({
  value,
  onChange,
  pathSegments,
  itemName,
  label,
  modalTitle,
  accept = 'image/*,video/mp4,video/webm'
}: Props) {
  const [open, setOpen] = useState(false);
  const { toast, confirm } = useAdminUiSafe();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const kind = getFileKind(value);

  async function handleQuickUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const uploaded = await uploadSingleFile(file, {
        pathSegments,
        itemName
      });

      onChange(uploaded.url);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeletePermanent() {
    if (!value) return;

    const confirmed = await confirm({
      title: 'Delete this file permanently from storage?',
      message: 'Anywhere this file is used will lose its image.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;

    try {
      setDeleting(true);
      await deleteUploadedFile({ url: value });
      onChange(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gap: 12
        }}
      >
        {label ? (
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontWeight: 600 }}>{label}</div>
          </div>
        ) : null}

        <div
          style={{
            width: 220,
            height: 160,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #ddd',
            background: '#f7f7f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {!value ? (
            <div style={{ fontSize: 14, opacity: 0.7 }}>No media selected</div>
          ) : kind === 'image' ? (
            <Image
              src={value}
              alt={label ?? 'Selected media'}
              width={220}
              height={160}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : kind === 'video' ? (
            <video
              src={value}
              controls
              preload="metadata"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <a href={value} target="_blank" rel="noreferrer">
              View file
            </a>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap'
          }}
        >
          <button type="button" onClick={() => setOpen(true)}>
            Choose from library
          </button>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                border: '1px solid #ccc',
                borderRadius: 8,
                padding: '8px 12px',
                background: '#fff'
              }}
            >
              {uploading ? 'Uploading...' : value ? 'Replace with upload' : 'Upload new'}
            </span>
            <input
              type="file"
              accept={accept}
              onChange={handleQuickUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>

          <button type="button" onClick={() => onChange(null)} disabled={!value}>
            Remove from section
          </button>

          <button
            type="button"
            onClick={() => void handleDeletePermanent()}
            disabled={!value || deleting}
          >
            {deleting ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
      </div>

      <MediaLibraryModal
        open={open}
        title={modalTitle ?? label ?? 'Media Library'}
        pathSegments={pathSegments}
        itemName={itemName}
        selectedUrl={value}
        accept={accept}
        onClose={() => setOpen(false)}
        onSelect={onChange}
      />
    </>
  );
}
