// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TransactionForm from "./components/TransactionForm";
import MonthlyReport from "./components/MonthlyReport";
import YearlyReport from "./components/YearlyReport";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import { useSwipeable } from "react-swipeable";
import LogoutButton from "./components/LogoutButton";
import useSyncCategoryOrder from "./hooks/useSyncCategoryOrder.js";
import SettingsPage from "./components/SettingsPage";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

function App() {
  useSyncCategoryOrder();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth)
          .then(() => {
            console.log("匿名ユーザーとしてログインしました");
          })
          .catch((error) => {
            console.error("匿名ログイン失敗:", error);
          });
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<MainApp />} />
      </Routes>
    </Router>
  );
}


const MainApp = () => {
  const [page, setPage] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      if (eventData.absX > 100) {
        setPage((prev) => Math.min(prev + 1, 3));
      }
    },
    onSwipedRight: (eventData) => {
      if (eventData.absX > 100) {
        setPage((prev) => Math.max(prev - 1, 0));
      }
    },
    delta: 10000,
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    };
  }, []);

  return (
    <div {...handlers} className="h-screen overflow-hidden bg-gray-100 relative">

      {/* ページ 0: 取引登録 */}
      {page === 0 && (
        <header className="absolute top-0 right-0 p-4">
          <LogoutButton />
        </header>
      )}
      {page === 0 && (
        <div className="flex flex-col items-center w-full">
          <div className="bg-white p-6 rounded-lg w-full">
            <TransactionForm
              editingTransaction={editingTransaction}
              onCloseEditMode={() => setEditingTransaction(null)}
            />
          </div>
        </div>
      )}

      {/* ページ 1: 月間レポート */}
      {page === 1 && (
        <div className="flex justify-center items-start w-full">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full">
            <MonthlyReport
              onEditTransaction={(tx) => {
                setEditingTransaction(tx);
                setPage(0);
              }}
            />
          </div>
        </div>
      )}

      {/* ページ 2: 年間レポート */}
      {page === 2 && (
        <div className="flex justify-center items-start w-full">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full">
            <YearlyReport />
          </div>
        </div>
      )}

      {/* ★ ページ 3: SettingsPage */}
      {page === 3 && (
        <div className="flex justify-center items-start w-full">
          {/* 設定ページを表示 */}
          <SettingsPage />
        </div>
      )}

      <div className="flex justify-center gap-4 my-4">
        <button
          onClick={() => setPage(0)}
          className={`px-4 py-2 rounded ${
            page === 0 ? "bg-[rgba(240,172,117,0.54)] text-black" : "bg-gray-300"
          }`}
        >
          登録
        </button>
        <button
          onClick={() => setPage(1)}
          className={`px-4 py-2 rounded ${
            page === 1 ? "bg-[rgba(240,172,117,0.54)] text-black" : "bg-gray-300"
          }`}
        >
          月間
        </button>
        <button
          onClick={() => setPage(2)}
          className={`px-4 py-2 rounded ${
            page === 2 ? "bg-[rgba(240,172,117,0.54)] text-black" : "bg-gray-300"
          }`}
        >
          年間
        </button>
        <button
          onClick={() => setPage(3)}
          className={`px-4 py-2 rounded ${
            page === 3 ? "bg-[rgba(240,172,117,0.54)] text-black" : "bg-gray-300"
          }`}
        >
          固定収支
        </button>
      </div>
    </div>
  );
};

export default App;
