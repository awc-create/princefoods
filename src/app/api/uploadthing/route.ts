import { createRouteHandler } from 'uploadthing/next';
import { ourFileRouter } from './core';

// Your version exports createRouteHandler
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter
});
