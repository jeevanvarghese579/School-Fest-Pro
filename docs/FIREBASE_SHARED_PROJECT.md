# Shared Firebase project: production rules baseline

Last confirmed by the user: 2026-09-19.

The Firebase project used by SchoolFest Pro is also used by other applications. The user supplied the current known-working Firestore and Firebase Storage rules. Those deployed rules are materially different from this repository's `firestore.rules`; therefore, the repository copy must not be treated as deployable production truth.

## Required production behavior to preserve

The supplied Firestore rules include all of the following:

- `/users/{uid}` and all descendants are readable/writable only by that authenticated UID. This is a shared namespace used by School Bell Manager V7 and other apps and must not be tied to one Firebase App ID.
- Ascension Manager uses Firebase App ID `1:379503088311:web:7b5117cc3447eded133332`, the `appRegistry`, `accessUsers`, `appExpirations`, and `invitedEmails` access checks, and stores data under `/ascensionManagerUsers/{uid}`.
- A signed-in user's invitation lookup is limited to their own lowercase email under `/invitedEmails/{email}`.
- The administrative collections `/admins`, `/adminInvites`, `/accessUsers`, `/accessInvites`, `/appRegistry`, `/accessRequests`, `/accessRequestKeys`, and `/mail` are server-only from the client rules perspective.
- `/inaugurationSessions/{sessionId}` preserves its special public-read, constrained-create, constrained-update, and no-delete behavior.
- A legacy top-level collection compatibility rule allows authenticated access except for the explicitly protected/shared collections above.

The supplied Firebase Storage rules include all of the following:

- `/users/{uid}/**` is readable/writable only by the matching authenticated UID.
- `/apps/{appId}/users/{uid}/**` is readable/writable only by the matching authenticated UID.
- Other legacy top-level folders remain available to signed-in users, excluding the reserved `users` and `apps` roots.

## Deployment safeguard

`firebase.json` maps Firestore deployment to the local `firestore.rules`. Consequently, plain `firebase deploy` is unsafe here: it may replace the working shared-project Firestore rules with the incompatible local file.

Before any rules work:

1. Export or otherwise obtain the latest deployed Firestore and Storage rules from the shared Firebase project.
2. Compare them with the user-supplied baseline and identify every application's protected path and access behavior.
3. Merge only the minimum SchoolFest-specific change into the full shared ruleset.
4. Run emulator tests covering SchoolFest and every preserved shared/legacy behavior.
5. Show the complete diff and obtain explicit user approval before deploying rules.

For a hosting-only SchoolFest release, scope deployment to `hosting:schoolfestpro`; do not use a plain, unscoped Firebase deploy command.

## Source snapshot

The exact user-supplied working rules were provided in the Codex attachment named `pasted-text.txt` on 2026-09-19. If an exact rules edit is requested later, use the latest exported deployed rules as the starting point rather than reconstructing them from this summary.
