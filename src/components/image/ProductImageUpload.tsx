'use client';

import type { OurFileRouter } from '@/app/api/uploadthing/core';
import { UploadDropzone } from '@uploadthing/react';
import Image from 'next/image';
import styles from './ProductImageUpload.module.scss';

interface Props {
  images: string[];
  setImages: (urls: string[]) => void;
}

export default function ProductImageUpload({ images, setImages }: Props) {
  const handleUploadComplete = (res: { url: string }[]) => {
    const newUrls = res.map((file) => file.url);
    setImages([...images, ...newUrls]);
  };

  const handleDelete = (url: string) => {
    setImages(images.filter((img) => img !== url));
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>
        Images <span className={styles.maxSize}>(Max 4MB)</span>
      </label>

      <UploadDropzone<OurFileRouter, 'productImage'>
        endpoint="productImage"
        onClientUploadComplete={handleUploadComplete}
        onUploadError={(err: Error) => console.error(err)}
        appearance={{
          container: styles.uploadCard,
          uploadIcon: styles.uploadIcon,
          label: styles.uploadLabel,
          button: styles.uploadButton
        }}
      />

      {images.length > 0 && (
        <div className={styles.gallery}>
          {images.map((url) => (
            <div key={url} className={styles.thumb}>
              <Image src={url} alt="Uploaded" className={styles.preview} width={800} height={800} />
              <button onClick={() => handleDelete(url)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
