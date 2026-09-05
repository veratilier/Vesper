# Vesper release preferences

- After implementing a user-requested Vesper change and passing the relevant checks and build, commit and push the scoped changes to `veratilier/Vesper`, then deploy the existing Cloudflare production Worker. The user authorized this default on 2026-09-05; a separate routine deployment confirmation is not needed.
- Use GitHub and Cloudflare only. Do not publish with Sites, create alternative hosting, or follow stale Sites hosting metadata as deployment instructions.
- The existing production config is `wrangler.production.jsonc` (Worker `vesper-api`, domains `vesper.r-vera.com` and `api.vesper.r-vera.com`). Preserve dashboard variables when deploying.
- Follow the current release branch; do not force-push, switch the deployment branch, or include unrelated working-tree edits. Verify the pushed commit and the production assets after deployment.
- Report the commit and deployment outcome accurately. If checks fail or publishing is blocked, explain the blocker rather than claiming success. Explicit later requests to hold deployment override this default.
- This release preference does not authorize unrelated changes, destructive data operations, or broader security/access changes.
