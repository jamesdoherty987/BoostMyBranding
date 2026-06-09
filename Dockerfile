# BoostMyBranding API for Render (or any Docker host): Node + FFmpeg + pnpm monorepo build.
# Build: docker build -t boost-api .
# Run:  docker run --rm -e PORT=8080 -p 8080:8080 --env-file .env.production boost-api
# (Use the same PORT the process listens on; Railway sets PORT automatically.)

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

# Run API with tsx so workspace packages that ship TypeScript (@boost/video, …)
# resolve the same way as local `pnpm dev` (plain `node dist/index.js` cannot load them).
CMD ["pnpm", "--filter", "api", "start"]
