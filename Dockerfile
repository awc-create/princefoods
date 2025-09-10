# site/Dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY package.json ./
COPY yarn.lock* pnpm-lock.yaml* package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install --immutable; \
    elif [ -f pnpm-lock.yaml ]; then corepack pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "No lockfile found; aborting." && exit 1; fi

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# These come from the workflow via build-args
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    SITE_URL=$SITE_URL

# Generate prisma client if present
RUN npx prisma generate || true

# Build Next (standalone)
RUN if [ -f yarn.lock ]; then yarn build; \
    elif [ -f pnpm-lock.yaml ]; then corepack pnpm build; \
    else npm run build; fi

# 🔎 Fail early if standalone wasn’t produced
RUN node -e "const fs=require('fs'); if(!fs.existsSync('.next/standalone/server.js')){console.error('\\n❌ Missing .next/standalone/server.js. Ensure output:\"standalone\" in next.config.*'); process.exit(1)}"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

# Copy the standalone server + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

RUN npm i -g prisma@6.13.0
USER 1001
EXPOSE 3000
CMD ["node","server.js"]
