// src/components/TransactionList.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

const USER1_UID = "yyJaRrazbhdHGXx702LyKJss8zX2";
const USER2_UID = "bRpkMFGXuZNbk8Hm78Wbv8IhJII2";
function getDisplayName(uid) {
  if (uid === USER1_UID) return "せいじ";
  if (uid === USER2_UID) return "はな";
  return "不明ユーザ";
}

function TransactionList({ onEdit }) {
  const [transactions, setTransactions] = useState([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    const qRef = query(
      collection(db, "transactions"),
      where("userId", "==", currentUser.uid),
      orderBy("date", "desc")
    );
    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(items);
    });
    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">取引一覧</h2>
      <ul className="space-y-3">
        {transactions.map((tx) => {
         const displayNames = tx.involvedUserIds
           ? tx.involvedUserIds.map((uid) => getDisplayName(uid))
           : [];

          return (
            <li
              key={tx.id}
              className="bg-gray-100 p-4 rounded-lg shadow flex justify-between items-center"
            >
              <div>
                <span className="text-gray-700">
                  【{tx.date}】 {tx.category} : {tx.amount}円
                </span>
                <span
                  className={`ml-3 px-3 py-1 text-white text-sm rounded-full ${
                    tx.type === "expense" ? "bg-red-500" : "bg-green-500"
                  }`}
                >
                  {tx.type === "expense" ? "支出" : "収入"}
                </span>
               {/* ここで「関与ユーザ」を表示 */}
               {displayNames.length > 0 && (
                 <div className="text-sm text-gray-600 mt-1">
                   編集: {displayNames.join("・")}
                 </div>
               )}
              </div>
              <button
                onClick={() => onEdit(tx)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                {/* Pencil Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 3.487a2.25 2.25 0 013.182 3.182l-12.78 12.78a1.125 1.125 0 01-.796.33H3.75v-2.583c0-.298.118-.583.33-.796l12.782-12.782z"
                  />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TransactionList;
