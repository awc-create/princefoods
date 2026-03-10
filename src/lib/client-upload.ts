export interface UploadedFileResult {
  name: string;
  size: number;
  type: string;
  objectKey: string;
  url: string;
}

export interface ListedMediaFile {
  objectKey: string;
  url: string;
  size: number;
  lastModified: string | null;
  type: 'image' | 'video' | 'unknown';
}

interface UploadMeta {
  pathSegments: string[];
  itemName: string;
}

export async function uploadSingleFile(file: File, meta: UploadMeta): Promise<UploadedFileResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('itemName', meta.itemName);
  formData.append('pathSegments', JSON.stringify(meta.pathSegments));

  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? 'Upload failed');
  }

  return data.file as UploadedFileResult;
}

export async function deleteUploadedFile(params: {
  objectKey?: string;
  url?: string;
}): Promise<void> {
  const res = await fetch('/api/admin/upload/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  const data = await res.json();

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? 'Delete failed');
  }
}

export async function listUploadedFiles(pathSegments: string[]): Promise<ListedMediaFile[]> {
  const res = await fetch('/api/admin/upload/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pathSegments })
  });

  const data = await res.json();

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? 'Failed to load files');
  }

  return Array.isArray(data.files) ? (data.files as ListedMediaFile[]) : [];
}
