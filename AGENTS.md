# Workspace instructions

## Shared Firebase project safety

This app uses a Firebase project that is shared with several other applications.

- Treat `docs/FIREBASE_SHARED_PROJECT.md` as required context before changing or deploying Firebase configuration, Firestore rules, Storage rules, authentication, or collection paths.
- The checked-in `firestore.rules` is **not** the current known-working shared-project production rules. Do not deploy it as-is.
- Never run an unscoped `firebase deploy` from this repository. It can deploy `firestore.rules` because `firebase.json` declares that file.
- For a SchoolFest hosting-only release, use the hosting-only target (`firebase deploy --only hosting:schoolfestpro`) after verifying the selected Firebase project.
- Any future rules proposal must preserve the other applications' access paths and special behavior documented in `docs/FIREBASE_SHARED_PROJECT.md`, and must be reviewed/tested as a complete merged shared-project ruleset before deployment.
- Do not overwrite production rules with an app-specific ruleset. Obtain/export the latest deployed Firestore and Storage rules first, merge narrowly, test all affected apps, and deploy only with explicit user approval.
