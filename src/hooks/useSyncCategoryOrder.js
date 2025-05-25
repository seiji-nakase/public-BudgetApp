import { useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function useSyncCategoryOrder() {
  const { currentUser } = useAuth();

  useEffect(() => {
    async function syncCategoryOrder() {
      if (!currentUser) return;

      try {
        console.log("🔥 Firestore categoryOrder を同期開始");

        const orderRef = doc(db, "users", currentUser.uid, "preferences", "categoryOrder");
        const docSnap = await getDoc(orderRef);

        if (!docSnap.exists()) {
          console.log("⚠️ categoryOrder が存在しないため、新規作成");

          // Firestore から categories を取得
          const catSnapshot = await getDocs(collection(db, "categories"));

          if (catSnapshot.empty) {
            throw new Error("❌ Firestore の categories が空です！");
          }

          const allCategoryIds = catSnapshot.docs.map(doc => doc.id);
          const initialOrder = {
            expenseOrder: allCategoryIds,
            incomeOrder: []
          };

          await setDoc(orderRef, initialOrder);
          console.log("✅ categoryOrder を作成しました:", initialOrder);
        } else {
          console.log("✅ categoryOrder が既に存在するため、新規作成しません");

          const data = docSnap.data();
          const expenseOrder = data.expenseOrder || [];
          const incomeOrder = data.incomeOrder || [];

          // Firestore のカテゴリを取得
          const catSnapshot = await getDocs(collection(db, "categories"));

          if (catSnapshot.empty) {
            throw new Error("❌ Firestore の categories が空です！");
          }

          const allCategories = catSnapshot.docs.map(doc => ({
            id: doc.id,
            type: doc.data().type
          }));

          // 既存の並び順に無いカテゴリを追加
          const newExpenseIds = allCategories
            .filter(cat => cat.type === "expense" && !expenseOrder.includes(cat.id))
            .map(cat => cat.id);
          const newIncomeIds = allCategories
            .filter(cat => cat.type === "income" && !incomeOrder.includes(cat.id))
            .map(cat => cat.id);

          if (newExpenseIds.length || newIncomeIds.length) {
            await updateDoc(orderRef, {
              expenseOrder: [...expenseOrder, ...newExpenseIds],
              incomeOrder: [...incomeOrder, ...newIncomeIds]
            });
            console.log("✅ 新しいカテゴリを並び順リストに追加しました");
          }
        }
      } catch (error) {
        console.error("🚨 Firestore のデータ取得・更新中にエラーが発生しました:", error);
      }
    }

    syncCategoryOrder();
  }, [currentUser]);
}
