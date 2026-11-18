Point every import at code that changes less often than the importer: a stable module that imports a volatile one changes whenever the volatile one does.
_Avoid_: a domain or core module importing from UI, a route, a feature folder or an experiment; a shared package importing from an app that uses it.
Detect: an import whose target changed in more of the last N commits than the importing file (count each path in `git log --name-only`); where the repo declares layers, an import from a lower layer into a higher one.
Not-when: the target is a narrow interface whose implementations churn behind it (depend-on-the-narrow-capability-you-use); the composition root, which imports everything by design; a test file.
Cross-ref: dependency-at-the-edges — impure capabilities wired at the root, the same direction rule for effects; complecting-shared-construct-split-by-reason-to-change — split the volatile part out when one module both changes often and is imported widely.
