import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

const PROJECT_ID = 'schoolfest-rules-test';
const APP_ID = '1:379503088311:web:5774bcc84597b656133332';
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const admin = context.firestore();
    await setDoc(doc(admin, 'appRegistry', APP_ID), { active: true });
    await setDoc(doc(admin, 'accessUsers', 'approved-user'), { active: true, apps: { [APP_ID]: true } });
    await setDoc(doc(admin, 'accessUsers', 'inactive-user'), { active: false, apps: { [APP_ID]: true } });
    await setDoc(doc(admin, 'accessUsers', 'wrong-app-user'), { active: true, apps: { other: true } });
  });
});

afterAll(async () => environment.cleanup());

describe('SchoolFest Firestore authorization', () => {
  it('allows an approved user to access only their own SchoolFest data', async () => {
    const db = environment.authenticatedContext('approved-user', { email: 'approved@example.com' }).firestore();
    await assertSucceeds(setDoc(doc(db, 'schoolFestProUsers', 'approved-user', 'data', 'main'), { students: [] }));
    await assertFails(getDoc(doc(db, 'schoolFestProUsers', 'someone-else', 'data', 'main')));
  });

  it('denies missing, inactive, and wrong-app permissions', async () => {
    for (const uid of ['unknown-user', 'inactive-user', 'wrong-app-user']) {
      const db = environment.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
      await assertFails(setDoc(doc(db, 'schoolFestProUsers', uid, 'data', 'main'), { students: [] }));
    }
  });

  it('denies unauthenticated access and direct Access Manager reads', async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'schoolFestProUsers', 'approved-user', 'data', 'main')));
    const approved = environment.authenticatedContext('approved-user', { email: 'approved@example.com' }).firestore();
    await assertFails(getDoc(doc(approved, 'accessUsers', 'approved-user')));
  });
});
