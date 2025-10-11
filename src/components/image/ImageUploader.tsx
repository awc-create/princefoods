'use client';

import type { OurFileRouter } from '@/app/api/uploadthing/core';
import { UploadDropzone } from '@uploadthing/react';
import Image from 'next/image';
import React from 'react';

type Endpoint = keyof OurFileRouter; // 'productImage' | 'siteImage'

interface Props {
  label?: string;
  endpoint: Endpoint;
  images: string[];
  setImages: (urls: string[]) => void;
  single?: boolean;
}

export default function ImageUploader({
  label,
  endpoint,
  images,
  setImages,
  single = false
}: Props) {
  // Filter out falsy/empty to avoid Next/Image empty src warnings
  const safeImages = React.useMemo(() => images.filter(Boolean), [images]);

  const handleComplete = (res: { url: string }[]) => {
    const urls = (res ?? []).map((f) => f?.url).filter(Boolean);
    if (urls.length === 0) return;

    if (single) {
      setImages([urls[0]]);
    } else {
      const merged = [...safeImages, ...urls];
      // de-dup
      const unique = Array.from(new Set(merged));
      setImages(unique);
    }
  };

  const handleDelete = (url: string) => {
    setImages(safeImages.filter((u) => u !== url));
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {label ? <label style={{ fontWeight: 600 }}>{label}</label> : null}

      <UploadDropzone<OurFileRouter, Endpoint>
        endpoint={endpoint}
        onClientUploadComplete={handleComplete}
        onUploadError={(e: Error) => console.error(e)}
        appearance={{
          container: 'ut-container',
          uploadIcon: 'ut-uploadIcon',
          label: 'ut-label',
          button: 'ut-button'
        }}
      />

      {safeImages.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          {safeImages.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              {/* Guard again — do not render Image without src */}
              {!!url && (
                <Image
                  src={url}
                  alt="Uploaded"
                  width={120}
                  height={120}
                  style={{
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #ccc'
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => handleDelete(url)}
                aria-label="Remove image"
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
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
