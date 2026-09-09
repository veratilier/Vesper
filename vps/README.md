# Vesper Codex history service

The static PWA reads and writes Codex conversation history through
`https://codex.r-vera.com/history`. The service runs beside `codex app-server`
on the Vesper VPS and authenticates the same bearer capability token.

Persistent data lives at `/home/ubuntu/.vesper/chat-history.sqlite3`. The
`conversations` table owns the Vesper-to-Codex mapping, title, timestamps, and
archive state. The `messages` table stores user and final agent messages with
their original timestamps and explicit `item_id` / `turn_id` columns for
idempotent snapshot merging.

Runtime files:

- `codex_history_server.py`: loopback-only HTTP/SQLite service on port 4510.
- `vesper-codex-history.service`: systemd unit.
- `nginx-codex-history.conf`: `/history/` reverse-proxy location for the
  existing authenticated `codex.r-vera.com` tunnel.

## Background wake executor

`vesper-wake.timer` invokes `vesper_wake_runner.py` every minute. It uses the
existing Ubuntu Codex ChatGPT login through a runner-owned stdio App Server.
No model API key is added; API-key accounts are rejected. The existing
`~/.codex/app-server-token` authenticates Vesper and the local history API.

- `~/.vesper/wake.sqlite3` stores jobs, tool outcomes, schedule, and foreground
  activity. `flock`, unique request IDs, and a transactional claim prevent duplicate
  execution. Interrupted model turns are marked interrupted, never replayed.
- Settings `careFrequency` remain authoritative: off/daily/twice-weekly. Scheduled
  jobs run 08:00–23:00 Asia/Singapore, about 24h/84h apart; active foreground turns
  defer pending jobs. Manual wakes join an existing queued/running job.
- Background turns are separate from browser-owned Codex threads. Final messages,
  wake cards, attachments, and tool summaries use the existing history API, in
  the `vesper-autonomous-wake` conversation. Existing conversations stay intact.
- Only explicitly listed native tools are available unattended. Extra approvals
  are declined. Native Desire reads remain isolated; background wakes do not
  create synthetic Desire encounters. Verification runs expose read-only tools.
- Replies are saved before POST `/api/wake` sends Web Push to stored Vesper
  subscriptions. D1 `vesper_wake_push` deduplicates delivery by job ID. Transport
  uncertainty never causes a model rerun or blind repeated push. `saved`,
  `push_failed`, and `completed` are distinct states; provider acceptance is not
  proof that the phone displayed the notification.
- The frontend no longer has an automatic wake timer. Manual buttons enqueue on
  VPS; status/polling and notification links open the existing chat presentation.

Install the runner/store beside the history service, back up the SQLite history
using its backup API, install the two systemd units, restart only history, and
`systemctl enable --now vesper-wake.timer`. Existing model/tunnel services and
login are left in place. Runtime files should be private to Ubuntu.

For the user-authorized closed-PWA acceptance test, schedule one real read-only
wake with `python3 vesper_wake_runner.py --schedule-verification 120`, then confirm
PWA closure before its due time. Check job completion, saved messages, native
read calls, and push receipt independently. Do not claim end-to-end acceptance
from timer activation alone. Test with `python3 -m unittest discover -s vps -p test_wake.py`.
