'use client';

import { useAdminUiSafe } from '@/components/admin/ui/AdminUiProvider';

import { deleteUploadedFile, uploadSingleFile } from '@/lib/client-upload';
import Image from 'next/image';
import { useState } from 'react';
import styles from './ProductImageUpload.module.scss';

interface Props {
  productName: string;
  images: string[];
  setImages: (urls: string[]) => void;
}

export default function ProductImageUpload({ productName, images, setImages }: Props) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useAdminUiSafe();
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (!productName.trim()) {
      toast.error('Please enter the product name before uploading images.');
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);

      const uploaded = await Promise.all(
        files.map((file) =>
          uploadSingleFile(file, {
            pathSegments: ['products', productName],
            itemName: 'gallery'
          })
        )
      );

      const newUrls = uploaded.map((file) => file.url);
      const merged = [...images, ...newUrls];
      const unique = Array.from(new Set(merged));

      setImages(unique);
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
      setImages(images.filter((img) => img !== url));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>
        Images <span className={styles.maxSize}>(Max 4MB)</span>
      </label>

      <div className={styles.uploadCard}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          disabled={uploading}
        />
        {uploading ? (
          <p className={styles.uploadLabel}>Uploading...</p>
        ) : (
          <p className={styles.uploadLabel}>Choose image(s) to upload</p>
        )}
      </div>

      {images.length > 0 && (
        <div className={styles.gallery}>
          {images.map((url) => (
            <div key={url} className={styles.thumb}>
              <Image src={url} alt="Uploaded" className={styles.preview} width={800} height={800} />
              <button
                type="button"
                onClick={() => void handleDelete(url)}
                disabled={deletingUrl === url}
              >
                {deletingUrl === url ? '...' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
