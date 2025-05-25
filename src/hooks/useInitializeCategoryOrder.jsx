// src/hooks/useInitializeCategoryOrder.js
import { useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export function useInitializeCategoryOrder() {
  const { currentUser } = useAuth();

  useEffect(() => {
    async function initCategoryOrder() {
      if (!currentUser) return;
      
      // ドキュメント参照
      const orderRef = doc(db, "users", currentUser.uid, "preferences", "categoryOrder");
      const docSnap = await getDoc(orderRef);
      
      // 既に存在すれば何もしない
      if (docSnap.exists()) {
        console.log("categoryOrder は既に存在しています");
        return;
      }
      
      // 既存のカテゴリ一覧を取得して、初期順序を作成する（例: 全カテゴリの ID を昇順で）
      const catSnapshot = await getDocs(collection(db, "categories"));
      const allCategories = catSnapshot.docs.map(doc => doc.id);
      
      // 初期データとして、expenseOrder に全カテゴリ、incomeOrder は空とする例
      const initialOrder = {
        expenseOrder: allCategories,
        incomeOrder: []
      };
      
      await setDoc(orderRef, initialOrder);
      console.log("categoryOrder を作成しました:", initialOrder);
    }
    initCategoryOrder();
  }, [currentUser]);
}
