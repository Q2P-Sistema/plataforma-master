FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/ui/ packages/ui/
COPY apps/web/ apps/web/
RUN pnpm --filter @atlas/web build

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
