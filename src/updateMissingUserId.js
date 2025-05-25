import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Firebase Admin SDK の初期化
const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = getFirestore();
const USER1_UID = "yyJaRrazbhdHGXx702LyKJss8zX2"; // せいじのユーザID

async function updateMissingCreatorId() {
  const transactionsCol = db.collection("transactions");
  const querySnapshot = await transactionsCol.get(); // すべての取引を取得

  const batch = db.batch();
  let count = 0;

  querySnapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();

    // `creatorId` が存在しない、または `none` の場合、更新
    if (!("creatorId" in data) || data.creatorId === "none" || data.creatorId === null || data.creatorId === "") {
      batch.update(transactionsCol.doc(docSnapshot.id), { creatorId: USER1_UID });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Updated ${count} documents with creatorId: ${USER1_UID}`);
  } else {
    console.log("⚠️ No documents were updated. It seems all creatorId fields are already set.");
  }
}

updateMissingCreatorId().catch((error) => console.error("Error updating documents:", error));
