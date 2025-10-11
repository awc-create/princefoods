import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

/**
 * Keep `productImage` for products (as-is), and add `siteImage`
 * for Home/About/etc. Both return `{ url }` so the client receives URLs.
 */
export const ourFileRouter = {
  productImage: f({ image: { maxFileSize: '4MB', maxFileCount: 8 } }).onUploadComplete(
    async ({ file }) => {
      return { url: file.url };
    }
  ),

  siteImage: f({ image: { maxFileSize: '4MB', maxFileCount: 10 } }).onUploadComplete(
    async ({ file }) => {
      return { url: file.url };
    }
  )
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
