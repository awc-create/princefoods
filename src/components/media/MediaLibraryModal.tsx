'use client';

import type { ListedMediaFile } from '@/lib/client-upload';
import { deleteUploadedFile, listUploadedFiles, uploadSingleFile } from '@/lib/client-upload';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
  open: boolean;
  title?: string;
  pathSegments: string[];
  itemName: string;
  selectedUrl: string | null;
  accept?: string;
  onClose: () => void;
  onSelect: (url: string | null) => void;
}

function getAcceptKind(accept: string): 'image' | 'video' | 'mixed' {
  const val = accept.toLowerCase();

  if (val.includes('image/') && val.includes('video/')) return 'mixed';
  if (val.includes('video/')) return 'video';
  return 'image';
}

export default function MediaLibraryModal({
  open,
  title = 'Media Library',
  pathSegments,
  itemName,
  selectedUrl,
  accept = 'image/*',
  onClose,
  onSelect
}: Props) {
  const [files, setFiles] = useState<ListedMediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptKind = useMemo(() => getAcceptKind(accept), [accept]);
  const pathKey = useMemo(() => pathSegments.join('/'), [pathSegments]);

  const filteredFiles = useMemo(() => {
    if (acceptKind === 'mixed') return files;
    if (acceptKind === 'image') return files.filter((f) => f.type === 'image');
    if (acceptKind === 'video') return files.filter((f) => f.type === 'video');
    return files;
  }, [files, acceptKind]);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await listUploadedFiles(pathSegments);
      setFiles(next);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [pathSegments]);

  useEffect(() => {
    if (!open) return;
    void loadFiles();
  }, [open, loadFiles, itemName, pathKey]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const pickedFiles = Array.from(e.target.files ?? []);
    if (pickedFiles.length === 0) return;

    try {
      setUploading(true);
      setError(null);

      const uploaded = await Promise.all(
        pickedFiles.map((file) =>
          uploadSingleFile(file, {
            pathSegments,
            itemName
          })
        )
      );

      await loadFiles();

      if (uploaded[0]?.url) {
        onSelect(uploaded[0].url);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(file: ListedMediaFile) {
    const confirmed = window.confirm('Delete this file permanently from storage?');
    if (!confirmed) return;

    try {
      setDeletingKey(file.objectKey);
      setError(null);

      await deleteUploadedFile({ objectKey: file.objectKey });

      if (selectedUrl === file.url) {
        onSelect(null);
      }

      setFiles((prev) => prev.filter((x) => x.objectKey !== file.objectKey));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingKey(null);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div
        style={{
          width: 'min(1100px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'grid',
          gap: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center'
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            <p style={{ margin: '6px 0 0', opacity: 0.7, fontSize: 14 }}>
              Browse existing files, upload new media, select one, or delete permanently.
            </p>
          </div>

          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <input
            type="file"
            accept={accept}
            multiple
            onChange={handleUpload}
            disabled={uploading}
          />
          <button type="button" onClick={() => void loadFiles()} disabled={loading}>
            Refresh
          </button>
          {uploading ? <span>Uploading...</span> : null}
          {loading ? <span>Loading...</span> : null}
        </div>

        {error ? (
          <div
            style={{
              background: '#fff3f3',
              color: '#b00020',
              padding: 12,
              borderRadius: 10,
              fontSize: 14
            }}
          >
            {error}
          </div>
        ) : null}

        {filteredFiles.length === 0 ? (
          <div
            style={{
              padding: 20,
              border: '1px dashed #ccc',
              borderRadius: 12,
              textAlign: 'center',
              opacity: 0.75
            }}
          >
            No files yet in this folder.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16
            }}
          >
            {filteredFiles.map((file) => {
              const isSelected = selectedUrl === file.url;
              const deleting = deletingKey === file.objectKey;

              return (
                <div
                  key={file.objectKey}
                  style={{
                    border: isSelected ? '2px solid #111' : '1px solid #ddd',
                    borderRadius: 12,
                    padding: 10,
                    display: 'grid',
                    gap: 10,
                    background: isSelected ? '#fafafa' : '#fff'
                  }}
                >
                  <div
                    style={{
                      height: 160,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: '#f6f6f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {file.type === 'image' ? (
                      <Image
                        src={file.url}
                        alt="Library file"
                        width={240}
                        height={160}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : file.type === 'video' ? (
                      <video
                        src={file.url}
                        controls
                        preload="metadata"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <a href={file.url} target="_blank" rel="noreferrer">
                        View file
                      </a>
                    )}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-word' }}>
                    {file.objectKey.split('/').slice(-2).join('/')}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(file.url);
                        onClose();
                      }}
                    >
                      Select
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(file)}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
