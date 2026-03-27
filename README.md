# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Notification Engine Environment Variables

PHWB notification dispatch, webhook, and cron integration uses these environment variables:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="PHWB Notifications <notifications@singforhope.org>"
RESEND_WEBHOOK_SECRET=whsec_...
CRON_SECRET=replace_with_secure_random_value
PHWB_INTEGRATION_BEARER_TOKEN=replace_with_secure_random_value
PHWB_INTEGRATION_HMAC_SECRET=replace_with_secure_random_value
PHWB_INTEGRATION_MAX_SKEW_SECONDS=300
```

### What each variable means

- `RESEND_API_KEY`: Resend API key used by `/api/notifications/dispatch`.
- `RESEND_FROM_EMAIL`: sender identity for outbound notifications.
- `RESEND_WEBHOOK_SECRET`: Svix secret used to verify `/api/notifications/webhooks/resend`.
- `CRON_SECRET`: shared bearer token automatically sent by Vercel Cron requests.
- `PHWB_INTEGRATION_BEARER_TOKEN`: shared bearer token for machine-to-machine auth.
- `PHWB_INTEGRATION_HMAC_SECRET`: shared secret for HMAC request signing.
- `PHWB_INTEGRATION_MAX_SKEW_SECONDS`: max allowed clock skew for signed requests (default 300).

### Generating secure values

Use cryptographically secure random generators:

```bash
python - <<'PY'
import secrets
print("PHWB_INTEGRATION_BEARER_TOKEN=" + secrets.token_urlsafe(48))
print("PHWB_INTEGRATION_HMAC_SECRET=" + secrets.token_urlsafe(64))
PY
```

or:

```bash
openssl rand -base64 48
openssl rand -base64 64
```

### Important

Set these values in PHWB environment variables (`.env` locally and deployment provider in prod).

Never commit real secrets to git.
