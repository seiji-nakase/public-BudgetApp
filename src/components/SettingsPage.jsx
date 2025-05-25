// src/components/SettingsPage.jsx

import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  arrayUnion,
} from "firebase/firestore";

export default function SettingsPage() {
  const { currentUser } = useAuth();

  // 新規入力用
  const [fixedType, setFixedType] = useState("expense");  // "expense" or "income"
  const [categoryName, setCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");

  // 一覧表示用
  const [fixedList, setFixedList] = useState([]);

  // 編集用
  const [editingId, setEditingId] = useState(null); // 編集中の doc ID
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [reflectDate, setReflectDate] = useState("");  // 過去取引への反映日

  useEffect(() => {
    if (!currentUser) return;
    const colRef = collection(db, "fixedCosts");
    const qRef = query(
      colRef,
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qRef, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setFixedList(list);
    });
    return () => unsub();
  }, [currentUser]);

  // カレンダーアイコンをクリックしたとき
  const handleCalendarIconClick = (inputId) => {
    const el = document.getElementById(inputId);
    if (el) {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
      }
    }
  };

  // 新規追加
  const handleSaveNew = async (e) => {
    e.preventDefault();
    if (!categoryName.trim() || !startDate || !amount) {
      alert("カテゴリ名、開始日、金額は必須です");
      return;
    }
    try {
      await addDoc(collection(db, "fixedCosts"), {
        userId: currentUser.uid,
        creatorId: currentUser.uid,
        involvedUserIds: [currentUser.uid],

        type: fixedType,
        category: categoryName.trim(),  // ★ フィールド名を「category」に統一
        // 修正: 金額を整数に変換し、誤差なく保存する
        amount: Math.round(Number(amount)),
        date: startDate,                // 「開始日」は「date」フィールドに
        frequency,
        revisions: [],                  // 初期状態は空の配列として保持
        createdAt: new Date(),
      });
      alert("固定収支を登録しました");
      // 入力欄をクリア
      setFixedType("expense");
      setCategoryName("");
      setAmount("");
      setFrequency("");
      setStartDate("");
    } catch (err) {
      console.error("固定収支登録エラー:", err);
      alert("登録に失敗しました");
    }
  };

  // 編集開始: 現在のドキュメント内容を編集フォームにセット
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditCategoryName(item.category || "");  // ★ 「category」
    setEditAmount(String(item.amount || ""));
    setEditFrequency(item.frequency || "");
    setEditStartDate(item.date || "");
    setReflectDate("");
  };

  // 編集内容の保存
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editCategoryName.trim() || !editStartDate || !editAmount) {
      alert("カテゴリ名、開始日、金額は必須です");
      return;
    }
    if (!editingId) return;

    try {
      const docRef = doc(db, "fixedCosts", editingId);
      const oldSnap = await getDoc(docRef);
      if (!oldSnap.exists()) {
        alert("既存の固定収支データが見つかりません");
        return;
      }
      const oldData = oldSnap.data();
      const oldCategory = oldData.category; // 変更前のカテゴリ名

      // 固定収支を更新し、反映日が指定されていれば編集履歴 (revisions) に追加する
      if (reflectDate) {
        await updateDoc(docRef, {
            category: editCategoryName.trim(),  // ★ 「category」
            frequency: editFrequency,
            // 既存の開始日と金額は更新せず、編集履歴にのみ新しい内容を追加
            revisions: arrayUnion({
              reflectDate,
              amount: Math.round(Number(editAmount)),
              updatedAt: new Date(),
            }),
          });
      } else {
        await updateDoc(docRef, {
          category: editCategoryName.trim(),  // ★ 「category」
          amount: Math.round(Number(editAmount)),
          date: editStartDate,
          frequency: editFrequency,
        });
      }

      // 反映日が指定されていれば、transactions にも反映する
      if (reflectDate) {
        const txRef = collection(db, "transactions");
        const qRef = query(
          txRef,
          where("userId", "==", currentUser.uid),
          where("category", "==", oldCategory),
          where("date", ">=", reflectDate),
          orderBy("date", "asc")
        );
        const snapshot = await getDocs(qRef);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach((txDocSnap) => {
            batch.update(txDocSnap.ref, {
              category: editCategoryName.trim(),
              involvedUserIds: arrayUnion(currentUser.uid),
            });
          });
          await batch.commit();
          console.log("過去の取引を更新しました");
        }
      }

      alert("編集を保存しました");
      setEditingId(null);
      setEditCategoryName("");
      setEditAmount("");
      setEditFrequency("");
      setEditStartDate("");
      setReflectDate("");
    } catch (err) {
      console.error("固定収支編集エラー:", err);
      alert("編集に失敗しました");
    }
  };

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null);
    setEditCategoryName("");
    setEditAmount("");
    setEditFrequency("");
    setEditStartDate("");
    setReflectDate("");
  };

  // 削除
  const handleDelete = async (itemId) => {
    const ok = window.confirm("削除しますか？");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "fixedCosts", itemId));
      alert("削除しました");
    } catch (err) {
      console.error("削除エラー:", err);
    }
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg w-full">
      {/* 新規登録フォーム */}
      <form onSubmit={handleSaveNew} className="space-y-3 mb-6">
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setFixedType("expense")}
            className={`px-4 py-2 rounded ${
              fixedType === "expense"
                ? "bg-[rgba(240,172,117,0.54)] text-black"
                : "bg-gray-300"
            }`}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => setFixedType("income")}
            className={`px-4 py-2 rounded ${
              fixedType === "income"
                ? "bg-[rgba(240,172,117,0.54)] text-black"
                : "bg-gray-300"
            }`}
          >
            収入
          </button>
        </div>

        <div>
          <label className="block text-gray-700">カテゴリ名</label>
          <input
            type="text"
            placeholder="例: 家賃 / 給料"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-gray-700">金額</label>
          <input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-gray-700">頻度</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none"
          >
            <option value="">選択してください</option>
            <option value="monthly">毎月</option>
            <option value="weekly">毎週</option>
            <option value="yearly">毎年</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700">開始日</label>
          <div className="relative">
            <input
              id="newStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-3 pr-10 border border-gray-300 rounded bg-white text-gray-700
                focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div
              onClick={() => handleCalendarIconClick("newStartDate")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 
                cursor-pointer text-gray-500 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10m-6 4h2m-2 4h2m5-12H5
                  a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9
                  a2 2 0 00-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="bg-[rgba(240,172,117,0.54)] text-black px-4 py-2 rounded hover:bg-[rgb(216,156,107)] transition w-full"
        >
          新規追加
        </button>
      </form>

      {/* 一覧表示 (スクロール) */}
      <div className="max-h-60 overflow-y-auto border-t pt-2">
        {fixedList.map((item) => {
          if (editingId === item.id) {
            // 編集フォーム表示中
            return (
              <div
                key={item.id}
                className="bg-gray-100 p-2 mb-2 rounded flex flex-col gap-2"
              >
                <div className="flex gap-2">
                  <label className="block text-gray-700 w-24">カテゴリ名</label>
                  <input
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="flex-1 p-2 border rounded"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="block text-gray-700 w-24">金額</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="flex-1 p-2 border rounded"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="block text-gray-700 w-24">頻度</label>
                  <select
                    value={editFrequency}
                    onChange={(e) => setEditFrequency(e.target.value)}
                    className="flex-1 p-2 border rounded"
                  >
                    <option value="">選択なし</option>
                    <option value="monthly">毎月</option>
                    <option value="weekly">毎週</option>
                    <option value="yearly">毎年</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <label className="block text-gray-700 w-24">開始日</label>
                  <div className="relative flex-1">
                    <input
                      id="editStartDate"
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full p-2 pr-8 border rounded"
                    />
                    <div
                      onClick={() => handleCalendarIconClick("editStartDate")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 
                        cursor-pointer text-gray-500 hover:text-gray-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10m-6 4h2m-2 4h2m5-12H5
                          a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9
                          a2 2 0 00-2-2z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 過去の取引更新用 反映日 */}
                <div className="flex gap-2">
                  <label className="block text-gray-700 w-24">反映する日にち</label>
                  <div className="relative flex-1">
                    <input
                      id="reflectDate"
                      type="date"
                      value={reflectDate}
                      onChange={(e) => setReflectDate(e.target.value)}
                      className="w-full p-2 pr-8 border rounded"
                    />
                    <div
                      onClick={() => handleCalendarIconClick("reflectDate")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 
                        cursor-pointer text-gray-500 hover:text-gray-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10m-6 4h2m-2 4h2m5-12H5
                          a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9
                          a2 2 0 00-2-2z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSaveEdit}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  >
                    保存
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            );
          } else {
            // 通常表示
            return (
              <div
                key={item.id}
                className="bg-gray-50 p-2 mb-2 rounded flex items-center justify-between"
              >
                <div>
                  <div className="text-base font-bold">
                    {item.type === "expense" ? "[支出]" : "[収入]"} {item.category}
                  </div>
                  <div className="text-sm text-gray-700">
                    金額: {item.amount} / 開始日: {item.date} / 頻度: {item.frequency || "なし"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* 編集ボタン */}
                  <button
                    onClick={() => startEdit(item)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    🖋
                  </button>
                  {/* 削除ボタン */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

