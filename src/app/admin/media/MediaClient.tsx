'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import type { ListedMediaFile } from '@/lib/client-upload';
import { deleteUploadedFile, listUploadedFiles, uploadSingleFile } from '@/lib/client-upload';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import styles from './media.module.scss';

interface MediaAreaOption {
  label: string;
  pathSegments: string[];
}

type MediaFilter = 'all' | 'image' | 'video';

const AREA_OPTIONS: MediaAreaOption[] = [
  { label: 'All Media', pathSegments: [] },
  { label: 'Products', pathSegments: ['products'] },
  { label: 'Categories', pathSegments: ['categories'] },
  { label: 'Celebrations', pathSegments: ['celebrations'] },
  { label: 'Home Page', pathSegments: ['pages', 'home'] },
  { label: 'Home Promotions', pathSegments: ['pages', 'home', 'promotions'] },
  { label: 'Home Showcase', pathSegments: ['pages', 'home', 'showcase'] },
  { label: 'About Page', pathSegments: ['pages', 'about'] },
  { label: 'FAQ Page', pathSegments: ['pages', 'faq'] },
  { label: 'Shop Page', pathSegments: ['pages', 'shop'] }
];

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getDefaultItemName(pathSegments: string[]): string {
  if (pathSegments.length === 0) return 'library-upload';
  return 'media';
}

export default function MediaClient() {
  const [selectedArea, setSelectedArea] = useState<string>('All Media');
  const [files, setFiles] = useState<ListedMediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast, confirm } = useAdminUi();
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const activeArea = useMemo(
    () => AREA_OPTIONS.find((x) => x.label === selectedArea) ?? AREA_OPTIONS[0],
    [selectedArea]
  );

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();

    return files.filter((file) => {
      const kind = getFileKind(file.url);

      if (filter !== 'all' && kind !== filter) return false;

      if (!q) return true;

      return (
        file.objectKey.toLowerCase().includes(q) ||
        file.url.toLowerCase().includes(q) ||
        kind.includes(q)
      );
    });
  }, [files, search, filter]);

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedKeys.includes(f.objectKey)),
    [files, selectedKeys]
  );

  async function loadFiles() {
    try {
      setLoading(true);
      setError(null);
      const next = await listUploadedFiles(activeArea.pathSegments);
      setFiles(next);
      setSelectedKeys([]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArea.label]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const pickedFiles = Array.from(e.target.files ?? []);
    if (pickedFiles.length === 0) return;

    try {
      setUploading(true);
      setError(null);

      await Promise.all(
        pickedFiles.map((file) =>
          uploadSingleFile(file, {
            pathSegments: activeArea.pathSegments,
            itemName: getDefaultItemName(activeArea.pathSegments)
          })
        )
      );

      await loadFiles();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(file: ListedMediaFile) {
    const confirmed = await confirm({
      title: 'Delete this file permanently?',
      message: file.objectKey,
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;

    try {
      setDeletingKey(file.objectKey);
      await deleteUploadedFile({ objectKey: file.objectKey });
      setFiles((prev) => prev.filter((x) => x.objectKey !== file.objectKey));
      setSelectedKeys((prev) => prev.filter((x) => x !== file.objectKey));
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedFiles.length === 0) return;

    const confirmed = await confirm({
      title: `Delete ${selectedFiles.length} selected file${selectedFiles.length === 1 ? '' : 's'} permanently?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;

    try {
      for (const file of selectedFiles) {
        await deleteUploadedFile({ objectKey: file.objectKey });
      }

      setFiles((prev) => prev.filter((x) => !selectedKeys.includes(x.objectKey)));
      setSelectedKeys([]);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copied to clipboard.');
    } catch {
      toast.error('Failed to copy URL.');
    }
  }

  function toggleSelected(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function toggleSelectAllVisible() {
    const visibleKeys = filteredFiles.map((f) => f.objectKey);
    const allSelected = visibleKeys.every((key) => selectedKeys.includes(key));

    if (allSelected) {
      setSelectedKeys((prev) => prev.filter((key) => !visibleKeys.includes(key)));
    } else {
      setSelectedKeys((prev) => Array.from(new Set([...prev, ...visibleKeys])));
    }
  }

  const allVisibleSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((file) => selectedKeys.includes(file.objectKey));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Media Library</h1>
        <p>Browse, upload, search, filter, copy, and manage site media.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.controlsGrid}>
          <label className={styles.field}>
            <span>Area</span>
            <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
              {AREA_OPTIONS.map((area) => (
                <option key={area.label} value={area.label}>
                  {area.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by folder, filename, or type"
            />
          </label>

          <label className={styles.field}>
            <span>Type</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as MediaFilter)}>
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>
          </label>

          <div className={styles.field}>
            <span>Upload</span>
            <label className={styles.uploadButton}>
              <span>{uploading ? 'Uploading…' : 'Upload files'}</span>
              <input
                type="file"
                accept="image/*,video/mp4,video/webm"
                multiple
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button type="button" onClick={() => void loadFiles()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={toggleSelectAllVisible}
            disabled={filteredFiles.length === 0}
          >
            {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
          </button>

          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={selectedKeys.length === 0}
            className={styles.dangerButton}
          >
            Delete selected ({selectedKeys.length})
          </button>

          <div className={styles.stats}>
            <span>
              <strong>{files.length}</strong> total
            </span>
            <span>
              <strong>{filteredFiles.length}</strong> visible
            </span>
            <span>
              Area path:{' '}
              <code>
                {activeArea.pathSegments.length ? activeArea.pathSegments.join('/') : 'all'}
              </code>
            </span>
          </div>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {loading && files.length === 0 ? (
        <div className={styles.empty}>Loading media…</div>
      ) : filteredFiles.length === 0 ? (
        <div className={styles.empty}>No files found for this area.</div>
      ) : (
        <div className={styles.grid}>
          {filteredFiles.map((file) => {
            const kind = getFileKind(file.url);
            const deleting = deletingKey === file.objectKey;
            const selected = selectedKeys.includes(file.objectKey);

            return (
              <div
                key={file.objectKey}
                className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
              >
                <div className={styles.cardTop}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(file.objectKey)}
                    />
                    <span>Select</span>
                  </label>

                  <span className={styles.kind}>{kind}</span>
                </div>

                <div className={styles.preview}>
                  {kind === 'image' ? (
                    <Image
                      src={file.url}
                      alt="Media preview"
                      width={320}
                      height={180}
                      className={styles.previewMedia}
                    />
                  ) : kind === 'video' ? (
                    <video
                      src={file.url}
                      controls
                      preload="metadata"
                      className={styles.previewMedia}
                    />
                  ) : (
                    <a href={file.url} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  )}
                </div>

                <div className={styles.meta}>
                  <div className={styles.objectKey}>{file.objectKey}</div>

                  <div className={styles.metaLine}>
                    {formatBytes(file.size)}
                    {file.lastModified ? ` • ${new Date(file.lastModified).toLocaleString()}` : ''}
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button type="button" onClick={() => void handleCopy(file.url)}>
                    Copy URL
                  </button>

                  <a href={file.url} target="_blank" rel="noreferrer" className={styles.linkButton}>
                    Open
                  </a>

                  <button
                    type="button"
                    onClick={() => void handleDelete(file)}
                    disabled={deleting}
                    className={styles.dangerButton}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
