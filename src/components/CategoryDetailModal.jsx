// src/components/CategoryDetailModal.jsx

import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// 2人だけと仮定した例。実際のUIDに置き換えてください
const USER1_UID = "yyJaRrazbhdHGXx702LyKJss8zX2";
const USER2_UID = "bRpkMFGXuZNbk8Hm78Wbv8IhJII2";

function getDisplayName(uid) {
  if (uid === USER1_UID) return "せいじ";
  if (uid === USER2_UID) return "はな";
  return "不明ユーザ";
}

/**
 * カテゴリ詳細モーダル
 */
export default function CategoryDetailModal({
  categoryName,
  ratioStr,
  year,
  month,
  onClose,
  onEditTransaction,
}) {
  const [transactions, setTransactions] = useState([]);
  const { currentUser } = useAuth();

  // モーダルが開いたら body のスクロールを無効化
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (!categoryName) return; // categoryNameが未定義なら取得しない

    let qRef;
    if (ratioStr && ratioStr !== "none") {
      // 共有カテゴリ（比率あり） → 全ユーザの取引を取得
      qRef = query(
        collection(db, "transactions"),
        where("category", "==", categoryName),
        orderBy("date", "asc")
      );
    } else {
      // 比率なし → このユーザの取引のみ
      qRef = query(
        collection(db, "transactions"),
        where("category", "==", categoryName),
        where("userId", "==", currentUser.uid),
        orderBy("date", "asc")
      );
    }

    const unsub = onSnapshot(qRef, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 年・月でフィルタ
      const filtered = all.filter((tx) => {
        if (!tx.date) return false;
        const [y, m] = tx.date.split("-");
        return parseInt(y, 10) === year && parseInt(m, 10) === month;
      });

      setTransactions(filtered);
    });

    return () => unsub();
  }, [categoryName, ratioStr, year, month, currentUser]);

  function handleEdit(tx) {
    onEditTransaction(tx);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      style={{ overscrollBehavior: "contain" }}
    >
      <div className="bg-white p-4 rounded w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-2">{categoryName} の履歴</h2>
        <p className="text-sm text-gray-600 mb-4">
          比率: {ratioStr || "none"}
        </p>

        {transactions.length === 0 ? (
          <p className="text-gray-500">履歴がありません</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {transactions.map((tx) => {
              // involvedUserIdsに基づいてユーザ名を生成
              const displayNames = tx.involvedUserIds
                ? tx.involvedUserIds.map((uid) => getDisplayName(uid))
                : [];

              return (
                <li
                  key={tx.id}
                  className="border p-2 rounded text-gray-700 flex justify-between items-center"
                >
                  <div>
                    <div>日付: {tx.date}</div>
                    <div>金額: {tx.amount.toLocaleString()}円</div>
                    <div>メモ: {tx.memo || "なし"}</div>
                    {/* 関わったユーザを表示 */}
                    <div>
                      関わったユーザ:{" "}
                      {displayNames.length > 0
                        ? displayNames.join("・")
                        : "なし"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEdit(tx)}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    🖋
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          onClick={onClose}
          className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
