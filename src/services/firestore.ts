import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Settings } from "../types";

export async function saveSettings(settings: Settings) {
  const user = auth.currentUser;

  if (!user) return;

  await setDoc(
    doc(db, "schoolFestProUsers", user.uid, "appData", "settings"),
    settings
  );
}

export async function loadSettings() {
  const user = auth.currentUser;

  if (!user) return null;

  const snap = await getDoc(
    doc(db, "schoolFestProUsers", user.uid, "appData", "settings")
  );

  return snap.exists() ? snap.data() : null;
}
