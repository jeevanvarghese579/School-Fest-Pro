import { doc } from 'firebase/firestore';
import { db } from '../firebase';

export const APP_KEY = 'schoolFestPro' as const;

export const userDocument = (uid: string, collectionName: string, documentId: string) =>
  doc(db, 'apps', APP_KEY, 'users', uid, collectionName, documentId);

export const userPath = (uid: string, suffix: string) =>
  `apps/${APP_KEY}/users/${uid}/${suffix}`;

