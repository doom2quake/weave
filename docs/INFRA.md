# Infrastructure

## Current state

Weave is not deployed from this working directory. It runs as static files with no backend, database, queue, account service, runtime key, or external data source.

## Intended hosting

- Publish directory: repository root
- Build command: none
- Suitable hosts: Netlify or Vercel static hosting
- Idle compute: none
- Standing application resource: none
- Runtime network call from the page: none
- Required WebMCP headers: included in `netlify.toml` and `vercel.json`

## Cost posture

Static hosting can use a free tier and has no project-owned standing compute. Check the selected host's bandwidth limits before deployment. No paid service or budget commitment has been made.

## Teardown checklist

1. Remove the static site from the chosen host.
2. Remove any custom domain record created for the demo.
3. Confirm the host no longer serves the project URL.

There are no databases, buckets, secrets, scheduled jobs, or model deployments to delete.
