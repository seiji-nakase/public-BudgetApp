// src/components/EditTransactionForm.jsx

import { useState } from "react";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
   arrayUnion
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

const EditTransactionForm = ({ transaction, onClose }) => {
  const { currentUser } = useAuth();
  const [amount, setAmount] = useState(transaction.amount);
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(transaction.date);
  const [memo, setMemo] = useState(transaction.memo || "");
  const [type, setType] = useState(transaction.type);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "transactions", transaction.id), {
        amount: Number(amount),
        category,
        date,
        memo,
        type,
        userId: currentUser.uid, // 必要に応じて残す or 管理方法を検討
       involvedUserIds: arrayUnion(currentUser.uid),
      });
      onClose(); // フォームを閉じる
    } catch (error) {
      console.error("取引更新エラー:", error);
    }
  };

  return (
    <form
      onSubmit={handleUpdate}
      className="mt-4 p-4 bg-white rounded-md shadow space-y-4"
    >
      <h3 className="text-lg font-bold">取引を編集</h3>

      <div>
        <label className="block text-gray-700">金額:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">カテゴリ:</label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">日付:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">メモ:</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">種類:</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="expense">支出</option>
          <option value="income">収入</option>
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
        >
          更新
        </button>
      </div>
    </form>
  );
};

export default EditTransactionForm;
