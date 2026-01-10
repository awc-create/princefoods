# site/Dockerfile
# syntax=docker/dockerfile:1

############################################
# 1) deps — install node_modules with cache
############################################
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat && corepack enable

# Copy only dependency manifests first (best layer cache)
COPY package.json ./
COPY yarn.lock* pnpm-lock.yaml* package-lock.json* ./

# Prisma schema MUST be present because your package.json runs:
# "postinstall": "prisma generate"
COPY prisma ./prisma

# Install deps (this will run postinstall -> prisma generate)
RUN if [ -f yarn.lock ]; then yarn install --immutable; \
    elif [ -f pnpm-lock.yaml ]; then corepack pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "No lockfile found; aborting." && exit 1; fi


############################################
# 2) builder — build Next.js standalone
############################################
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat && corepack enable

# deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/prisma ./prisma

# Copy the full app
COPY . .

# Build args from GitHub Action
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG SITE_URL
ARG USE_DB

# ✅ ADD: Crisp site id
ARG NEXT_PUBLIC_CRISP_WEBSITE_ID

# Make them available at build time (Next.js bakes NEXT_PUBLIC_* into client bundle)
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    SITE_URL=$SITE_URL \
    USE_DB=$USE_DB \
    NEXT_PUBLIC_CRISP_WEBSITE_ID=$NEXT_PUBLIC_CRISP_WEBSITE_ID

# Prisma generate again (idempotent) — ensures client matches schema in repo
RUN npx prisma generate

# Build (requires next.config output:"standalone")
RUN if [ -f yarn.lock ]; then yarn build; \
    elif [ -f pnpm-lock.yaml ]; then corepack pnpm build; \
    else npm run build; fi

# Fail early if standalone not produced
RUN node -e "const fs=require('fs'); if(!fs.existsSync('.next/standalone/server.js')){console.error('\\n❌ Missing .next/standalone/server.js. Ensure output:\"standalone\" in next.config.*'); process.exit(1)}"


############################################
# 3) runner — minimal runtime image
############################################
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

# Copy standalone output
COPY --from=builder /app/.next/standalone ./

# Static + public assets
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma folder is useful for migrations at runtime (if you ever exec them)
COPY --from=builder /app/prisma ./prisma

# (Optional) if you run prisma migrate deploy inside the container, you need prisma CLI.
RUN npm i -g prisma@6.15.0

USER 1001
EXPOSE 3000
CMD ["node","server.js"]
