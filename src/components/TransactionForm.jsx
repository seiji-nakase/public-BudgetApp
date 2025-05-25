// src/components/TransactionForm.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion
} from "firebase/firestore";
import CategoryPicker from "./CategoryPicker";
import { useAuth } from "../context/AuthContext";

const TransactionForm = ({ editingTransaction, onCloseEditMode }) => {
  const { currentUser } = useAuth();
  const [transactionType, setTransactionType] = useState("expense");
  const [showAddForm, setShowAddForm] = useState(false);

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // "YYYY-MM-DD"
  };

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(getTodayDate());
  const [memo, setMemo] = useState("");

  // 編集モードかどうかで初期値を変える
  useEffect(() => {
    if (editingTransaction) {
      setTransactionType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setCategory(editingTransaction.category);
      setDate(editingTransaction.date);
      setMemo(editingTransaction.memo || "");
    } else {
      setTransactionType("expense");
      setAmount("");
      setCategory("");
      setDate(getTodayDate());
      setMemo("");
    }
  }, [editingTransaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ▼ カテゴリが空なら登録不可
    if (!category) {
      alert("カテゴリを選択してください");
      return;
    }

    try {
      if (editingTransaction) {
        // 既存取引を更新
        await updateDoc(doc(db, "transactions", editingTransaction.id), {
          amount: Number(amount),
          category,
          date,
          memo,
          type: transactionType,
          userId: currentUser.uid,
          involvedUserIds: arrayUnion(currentUser.uid)
        });
        alert("取引を更新しました");
        onCloseEditMode();
      } else {
        // 新規登録
        await addDoc(collection(db, "transactions"), {
          amount: Number(amount),
          category,
          date,
          memo,
          type: transactionType,
          userId: currentUser.uid,
          creatorId: currentUser.uid,
          involvedUserIds: [currentUser.uid]
        });
        alert("新規取引を登録しました");
      }

      // 入力欄を初期化
      setTransactionType("expense");
      setAmount("");
      setCategory("");
      setDate(getTodayDate());
      setMemo("");
    } catch (error) {
      console.error("エラー:", error);
      alert("登録/更新に失敗しました");
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    const confirmDelete = window.confirm("この取引を削除しますか？");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "transactions", editingTransaction.id));
      alert("取引を削除しました");
      onCloseEditMode();
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    }
  };

  const handleCalendarIconClick = () => {
    const input = document.getElementById("dateInput");
    if (input) {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.focus();
      }
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTransactionType("expense")}
          className={`px-4 rounded ${
            transactionType === "expense"
              ? "bg-[rgba(240,172,117,0.54)] text-[rgba(0,0,0,0.84)]"
              : "bg-gray300"
          }`}
        >
          支出
        </button>
        <button
          onClick={() => setTransactionType("income")}
          className={`px-4 py-2 rounded ${
            transactionType === "income"
              ? "bg-[rgba(240,172,117,0.54)] text-black"
              : "bg-gray-300"
          }`}
        >
          収入
        </button>
      </div>

      <div>
        <label className="block text-gray-700">日付</label>
        <div className="relative">
          <input
            id="dateInput"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full p-3 pr-10 border border-gray-300 rounded bg-white text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div
            onClick={handleCalendarIconClick}
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700">メモ:</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded bg-white text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-gray-700">金額</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded bg-white text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-gray-700">カテゴリ</label>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              type="button"
              className="bg-gray-200 text-gray-700 px-2 py-1 rounded-md hover:bg-gray-300 transition"
            >
              {showAddForm ? "−" : "＋"}
            </button>
          </div>
          <CategoryPicker
            selectedCategory={category}
            onSelectCategory={(catName) => setCategory(catName)}
            categoryType={transactionType}
            showAddForm={showAddForm}
          />
        </div>

        <div className="flex gap-2 justify-center w-full">
          {editingTransaction && (
            <button
              type="button"
              onClick={handleDelete}
              className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 transition w-full"
            >
              削除
            </button>
          )}
          <button
            type="submit"
            className="bg-[rgba(240,172,117,0.54)] text-black px-3 py-2 rounded hover:bg-[rgb(216,156,107)] transition w-full"
          >
            {editingTransaction ? "更新" : "登録"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
