import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export async function saveSettings(settings: any) {
  const user = auth.currentUser;

  if (!user) return;

  await setDoc(
    doc(db, "users", user.uid, "appData", "settings"),
    settings
  );
}

export async function loadSettings() {
  const user = auth.currentUser;

  if (!user) return null;

  const snap = await getDoc(
    doc(db, "users", user.uid, "appData", "settings")
  );

  return snap.exists() ? snap.data() : null;
}