# BoostMyBranding API for Render (or any Docker host): Node + FFmpeg + pnpm monorepo build.
# Build: docker build -t boost-api .
# Run:  docker run --rm -p 4000:4000 -e PORT=4000 --env-file .env.production boost-api

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Do **not** set NODE_ENV=production before `pnpm install`. Root `turbo` lives in
# devDependencies; with NODE_ENV=production pnpm skips dev deps and `turbo` is
# missing → `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "turbo" not found`.
ENV NODE_ENV=development

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY . .

# turbo.json lists `.env` as a global dependency; image must not include real secrets.
RUN touch .env

RUN pnpm install --frozen-lockfile

RUN pnpm exec turbo run build --filter=api

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
