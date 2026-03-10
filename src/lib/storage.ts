import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

const bucket = requiredEnv('HETZNER_S3_BUCKET');
const endpoint = requiredEnv('HETZNER_S3_ENDPOINT');
const region = requiredEnv('HETZNER_S3_REGION');
const accessKeyId = requiredEnv('HETZNER_S3_ACCESS_KEY_ID');
const secretAccessKey = requiredEnv('HETZNER_S3_SECRET_ACCESS_KEY');
const publicBaseUrl = requiredEnv('HETZNER_S3_PUBLIC_BASE_URL');

export const storageClient = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return 'bin';
  return parts.pop()?.toLowerCase() ?? 'bin';
}

export function buildObjectKey(params: {
  root: string;
  pathSegments?: string[];
  mediaType: 'images' | 'videos';
  itemName: string;
  filename: string;
}) {
  const { root, pathSegments = [], mediaType, itemName, filename } = params;

  const ext = getExtension(filename);
  const uuid = crypto.randomUUID();

  const parts = [
    slugify(root),
    ...pathSegments.map((part) => slugify(part)).filter(Boolean),
    mediaType,
    slugify(itemName),
    `${uuid}.${ext}`
  ];

  return parts.join('/');
}

export function getPublicFileUrl(objectKey: string): string {
  return `${publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
}

export function getObjectKeyFromPublicUrl(url: string): string | null {
  const base = publicBaseUrl.replace(/\/$/, '');
  if (!url.startsWith(base)) return null;

  const key = url.slice(base.length).replace(/^\/+/, '').trim();
  return key || null;
}

export async function uploadBufferToStorage(params: {
  buffer: Buffer;
  objectKey: string;
  contentType: string;
  contentDisposition?: string;
}) {
  const { buffer, objectKey, contentType, contentDisposition } = params;

  await storageClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: contentDisposition
    })
  );

  return {
    objectKey,
    url: getPublicFileUrl(objectKey)
  };
}

export async function deleteFromStorage(objectKey: string) {
  await storageClient.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey
    })
  );
}

export async function listFilesFromStorage(prefix: string) {
  const result = await storageClient.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    })
  );

  return (result.Contents ?? [])
    .filter((item) => !!item.Key && !item.Key.endsWith('/'))
    .map((item) => ({
      objectKey: item.Key as string,
      url: getPublicFileUrl(item.Key as string),
      size: item.Size ?? 0,
      lastModified: item.LastModified?.toISOString() ?? null
    }));
}
