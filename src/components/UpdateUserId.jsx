// src/components/UpdateUserId.jsx
import { useEffect } from "react";
import { db, auth } from "../firebase"; // firebase.js で設定した auth と db をインポート
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const UpdateUserId = () => {
  useEffect(() => {
    const updateDocuments = async (user) => {
      const userId = user.uid;
      console.log("Updating existing data with userId:", userId);

      // transactions コレクションの更新
      const transactionsRef = collection(db, "transactions");
      const transactionsSnapshot = await getDocs(transactionsRef);
      transactionsSnapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "transactions", docSnap.id), {
          userId: userId,
        });
      });

      // categories コレクションの更新
      const categoriesRef = collection(db, "categories");
      const categoriesSnapshot = await getDocs(categoriesRef);
      categoriesSnapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "categories", docSnap.id), {
          userId: userId,
        });
      });

      console.log("既存のデータに userId を追加しました");
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        updateDocuments(user);
      } else {
        console.log("ユーザーがログインしていません");
      }
    });

    return () => unsubscribe();
  }, []);

  return <div>既存データを更新中…（完了したらこのコンポーネントを削除してください）</div>;
};

export default UpdateUserId;
