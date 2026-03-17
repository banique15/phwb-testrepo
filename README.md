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

## VoiceAI Integration Environment Variables

PHWB Phase 2 notification dispatch/callback integration uses these environment variables:

```env
VOICEAI_BASE_URL=http://localhost:8000
PHWB_INTEGRATION_BEARER_TOKEN=replace_with_secure_random_value
PHWB_INTEGRATION_HMAC_SECRET=replace_with_secure_random_value
PHWB_INTEGRATION_MAX_SKEW_SECONDS=300
```

### What each variable means

- `VOICEAI_BASE_URL`: base URL for the `voiceaiagentv5` API.
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

Set the same token/secret values in both apps:

- PHWB (`/home/jesse/projects/phwb/.env`)
- voiceaiagentv5 (`/home/jesse/projects/voiceaiagentv5/.env`)

Never commit real secrets to git.
