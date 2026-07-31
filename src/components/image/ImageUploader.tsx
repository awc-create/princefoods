'use client';

import { useAdminUiSafe } from '@/components/admin/ui/AdminUiProvider';

import { deleteUploadedFile, uploadSingleFile } from '@/lib/client-upload';
import Image from 'next/image';
import React from 'react';

interface Props {
  label?: string;
  files?: string[];
  setFiles: (urls: string[]) => void;
  single?: boolean;
  pathSegments: string[];
  itemName: string;
  accept?: string;
}

function getFileKind(url: string): 'image' | 'video' | 'unknown' {
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

export default function ImageUploader({
  label,
  files,
  setFiles,
  single = false,
  pathSegments,
  itemName,
  accept = 'image/*,video/mp4,video/webm'
}: Props) {
  const [uploading, setUploading] = React.useState(false);
  const { toast } = useAdminUiSafe();
  const [deletingUrl, setDeletingUrl] = React.useState<string | null>(null);

  const safeFiles = React.useMemo(() => (files ?? []).filter(Boolean), [files]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = Array.from(e.target.files ?? []);
    if (pickedFiles.length === 0) return;

    if (!itemName.trim()) {
      toast.error('Please enter a name before uploading files.');
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);

      const uploaded = await Promise.all(
        pickedFiles.map((file) =>
          uploadSingleFile(file, {
            pathSegments,
            itemName
          })
        )
      );

      const urls = uploaded.map((file) => file.url).filter(Boolean);

      if (urls.length === 0) return;

      if (single) {
        setFiles([urls[0]]);
      } else {
        const merged = [...safeFiles, ...urls];
        const unique = Array.from(new Set(merged));
        setFiles(unique);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (url: string) => {
    try {
      setDeletingUrl(url);
      await deleteUploadedFile({ url });
      setFiles(safeFiles.filter((u) => u !== url));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {label ? <label style={{ fontWeight: 600 }}>{label}</label> : null}

      <div
        style={{
          border: '1px dashed #ccc',
          borderRadius: 12,
          padding: '1rem',
          display: 'grid',
          gap: '0.5rem'
        }}
      >
        <input
          type="file"
          accept={accept}
          multiple={!single}
          onChange={handleFilesSelected}
          disabled={uploading}
        />

        <div style={{ fontSize: 14, opacity: 0.8 }}>
          {uploading
            ? 'Uploading...'
            : single
              ? 'Upload one image or video'
              : 'Upload one or more images/videos'}
        </div>
      </div>

      {safeFiles.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          {safeFiles.map((url) => {
            const kind = getFileKind(url);

            return (
              <div
                key={url}
                style={{
                  position: 'relative',
                  width: 120
                }}
              >
                <div
                  style={{
                    width: 120,
                    height: 120,
                    overflow: 'hidden',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    background: '#f7f7f7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {kind === 'image' ? (
                    <Image
                      src={url}
                      alt="Uploaded"
                      width={120}
                      height={120}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : kind === 'video' ? (
                    <video
                      src={url}
                      controls
                      preload="metadata"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        textAlign: 'center',
                        padding: 8
                      }}
                    >
                      View file
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleDelete(url)}
                  aria-label="Remove file"
                  disabled={deletingUrl === url}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: 'none',
                    background: '#e53935',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: deletingUrl === url ? 0.7 : 1
                  }}
                >
                  {deletingUrl === url ? '…' : '×'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
