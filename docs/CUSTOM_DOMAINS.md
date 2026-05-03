# Custom domain setup

This guide is for the agency team. It covers both the one-time platform setup
and the per-client flow you'll follow in the dashboard.

## Platform setup (one-time)

Before clients can attach custom domains, the platform needs Vercel API
access. Skip this whole section if it's already done — you'll know because
the **Domain** tab in the website editor won't surface errors.

1. **Create a Vercel API token**
   - Go to https://vercel.com/account/tokens
   - Click *Create token*, give it a name like `boost-domains-api`
   - Grant "Full Account" scope (this is needed to write to the project's
     domains list; we can tighten it later with a team-scoped token)
   - Copy the token — you won't see it again

2. **Find your project IDs**
   - Open the `web` project in the Vercel dashboard
   - Go to *Settings → General* and copy the **Project ID**
   - If the project is in a team (not a personal account), also note the
     **Team ID** from the team's settings

3. **Add to the API server env**
   ```
   VERCEL_API_TOKEN=vr_xxx
   VERCEL_PROJECT_ID=prj_xxx
   VERCEL_TEAM_ID=team_xxx   # only if the project is in a team
   ```

4. **Run the database migration**
   The custom-domain columns are in migration `0004_custom_domains.sql`.
   Apply it however you run migrations (Drizzle Kit, or raw psql).

5. **Verify the middleware is live**
   Once deployed, hit the main app URL. Nothing should change. Then try
   hitting any unknown `*.example.com` host (you can use `curl -H "Host: ..."`
   locally). You should be redirected to the main app URL — that confirms
   the middleware is intercepting and the resolver is working.

## Per-client flow (what you do every time)

For every client who wants their own domain:

1. **Open the client's website** in the dashboard (*Websites* page).

2. **Go to the Domain tab** in the Site Editor panel.

3. **Enter their domain** (e.g. `murphysplumbing.com` — no `https://`, no `www.`).

4. **Click Attach domain.**
   The platform creates a Vercel domain, saves it on the client record,
   and returns the DNS record the customer needs.

5. **Send the DNS record to the client.**
   There are two types of record depending on whether it's an apex
   (`murphysplumbing.com`) or subdomain (`www.murphysplumbing.com`):

   - **Apex domain** → `A` record pointing to `76.76.21.21`
   - **Subdomain** → `CNAME` pointing to `cname.vercel-dns.com`

   The Domain tab shows the exact values to copy-paste with a one-click
   copy button next to each one.

6. **Ask the client to add the record** in their domain registrar's
   DNS management panel. Every registrar (GoDaddy, Namecheap, Cloudflare,
   Hover, etc.) has a "DNS" section. The customer needs:
   - Type: (as shown, e.g. `A`)
   - Name/Host: (as shown, usually `@` for apex or the subdomain label)
   - Value: (as shown)
   - TTL: leave at default (usually 3600 or auto)

7. **Wait 1–10 minutes for DNS to propagate.**
   For most registrars this is near-instant. Slow registrars can take up
   to an hour, and old TTL caches can hold things up further.

8. **Click Check verification.**
   If DNS is live, the status flips to **verified** and the site is now
   serving on the custom domain with automatic TLS.

## Troubleshooting

- **"That domain is already attached to another client"** — every domain
  can only attach to one client. Detach from the other client first.

- **"Failed" status with a Vercel error** — the token may have expired or
  lost access to the project. Re-check the env vars.

- **DNS set but still not verified** — Cloudflare-proxied domains need
  their proxy turned OFF (grey cloud) because Vercel needs direct DNS
  access to issue the certificate. Once verified, the proxy can go back on.

- **"Unknown host" redirect** — if a client's DNS is right but the site
  still redirects to the main app, the resolver cache may be stale.
  Edge caches refresh every 5 minutes. Wait, or redeploy to clear it.

## How it works under the hood

Rough architecture:

```
Client visits murphysplumbing.com
  → DNS resolves to Vercel
  → Vercel routes to our web project (domain attached)
  → Next.js middleware (apps/web/middleware.ts) runs at the edge
  → Middleware calls API /clients/public/by-host/:host
  → API returns the slug (cached 5 min per edge instance)
  → Middleware rewrites URL to /sites/[slug] internally
  → Normal sites renderer serves the page
```

No per-client folders, no per-client deploys — everything is a single Next.js
app serving many tenants from the same codebase. The `customDomain` column
is the only thing tying a domain to a client.
