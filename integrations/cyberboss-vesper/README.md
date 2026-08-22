# CyberBoss ↔ Vesper

This adapter replaces CyberBoss's WeChat channel with the Vesper PWA while preserving the Codex/Claude runtime, shared threads, diary, reminders, timeline, check-ins, and project tools.

Install it into a CyberBoss checkout:

```bash
node /path/to/Vesper/integrations/cyberboss-vesper/install.mjs /path/to/cyberboss
```

Add these values to CyberBoss's private `.env`:

```dotenv
CYBERBOSS_CHANNEL=vesper
CYBERBOSS_VESPER_BASE_URL=https://api.vesper.r-vera.com
CYBERBOSS_VESPER_TOKEN=use_the_worker_bridge_secret
CYBERBOSS_VESPER_USER_ID=vesper-user
CYBERBOSS_ALLOWED_USER_IDS=vesper-user
CYBERBOSS_CHECKIN_USER_ID=vesper-user
CYBERBOSS_WORKSPACE_ROOT=/absolute/path/to/your/project
```

Then start CyberBoss normally:

```bash
npm run shared:start
```

Use `/bind /absolute/path` as the first Vesper chat message if the workspace has not been bound yet.

Never commit `CYBERBOSS_VESPER_TOKEN`. It must match the Worker secret named `VESPER_BRIDGE_TOKEN`.
