FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

COPY . .
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @mangotalk/api build

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/apps/api/src/main.js"]
