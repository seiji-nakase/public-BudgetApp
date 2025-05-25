// src/components/YearlyReport.jsx

import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { useAuth } from "../context/AuthContext";

const YearlyReport = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 比率を反映した「支出」「収入」集計用の配列
  const [expenseData, setExpenseData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);

  // 表示モード: "expense" or "income"
  const [viewMode, setViewMode] = useState("expense");

  const { currentUser } = useAuth();

  // ★ 2人のユーザIDを想定
  const SEIJI_UID = "yyJaRrazbhdHGXx702LyKJss8zX2";  // ユーザ1
  const HANA_UID = "bRpkMFGXuZNbk8Hm78Wbv8IhJII2";  // ユーザ2
  const isUser1 = currentUser?.uid === SEIJI_UID;

  // カテゴリ情報 (ratio, sharedなど)
  const [categoryMap, setCategoryMap] = useState({});

  // ▼ カテゴリを購読
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "categories"));
    const unsubCat = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((doc) => {
        const d = doc.data();
        map[d.name] = {
          ratio: d.ratio || "none",
          shared: d.shared === undefined ? true : d.shared,
        };
      });
      setCategoryMap(map);
    });
    return () => unsubCat();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // ★ 1) 同時に "transactions" と "fixedCosts" を購読し、合体する
    const qTx = query(collection(db, "transactions"));
    const qFc = query(collection(db, "fixedCosts"));

    let allTxItems = [];
    let allFcItems = [];

    const unsubTx = onSnapshot(qTx, (snap) => {
      allTxItems = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      combineAndCompute();
    });
    const unsubFc = onSnapshot(qFc, (snap) => {
      allFcItems = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      combineAndCompute();
    });

    // ★ 2) 合体して集計する関数
    const combineAndCompute = () => {
      // 固定収支を選択年内で展開する
      const expandedFixedCosts = expandFixedCosts(allFcItems, selectedYear);
      // 同じ形式 (date, type, amount, category, creatorId など) で扱える想定
      const combined = [...allTxItems, ...expandedFixedCosts];

      // カテゴリ共有判定
      const filteredByShare = combined.filter((it) => {
        if (!categoryMap[it.category]) return it.userId === currentUser.uid;
        return categoryMap[it.category].ratio !== "none"
          ? true
          : it.userId === currentUser.uid;
      });

      // 年度フィルタ
      const filtered = filteredByShare.filter((it) => {
        if (!it.date) return false;
        const [y] = it.date.split("-");
        return parseInt(y, 10) === selectedYear;
      });

      // 支出 / 収入 に分割
      const expenseItems = filtered.filter((it) => it.type === "expense");
      const incomeItems = filtered.filter((it) => it.type === "income");

      // カテゴリごとの合計
      const expenseMap = {};
      expenseItems.forEach((it) => {
        // 固定収支の場合、キーを「固定支出」とする
        const key = it.frequency ? "固定支出" : it.category;
        if (!expenseMap[key]) expenseMap[key] = 0;
        expenseMap[key] += it.amount;
      });
      const incomeMap = {};
      incomeItems.forEach((tx) => {
        if (!incomeMap[tx.category]) incomeMap[tx.category] = 0;
        incomeMap[tx.category] += tx.amount;
      });

      // ★ 3) ユーザごとの比率を反映
      const expenseArr = Object.keys(expenseMap).map((catName) => {
        const total = expenseMap[catName];
        const ratioStr = categoryMap[catName]?.ratio || "none";
        let userValue = total;
        if (ratioStr !== "none") {
          const parts = ratioStr.split(":");
          if (parts.length === 2) {
            const a = parseFloat(parts[0]);
            const b = parseFloat(parts[1]);
            if (a && b) {
              const ratioToUse = isUser1 ? a : b;
              userValue = Math.round((total * ratioToUse) / (a + b));
            }
          }
        }
        const splitResult = computeSplit(total, ratioStr);
        return { name: catName, value: userValue, ratioStr, splitResult };
      });

      const incomeArr = Object.keys(incomeMap).map((catName) => {
        const total = incomeMap[catName];
        const ratioStr = categoryMap[catName]?.ratio || "none";
        let userValue = total;
        if (ratioStr !== "none") {
          const parts = ratioStr.split(":");
          if (parts.length === 2) {
            const a = parseFloat(parts[0]);
            const b = parseFloat(parts[1]);
            if (a && b) {
              const ratioToUse = isUser1 ? a : b;
              userValue = Math.round((total * ratioToUse) / (a + b));
            }
          }
        }
        const splitResult = computeSplit(total, ratioStr);
        return { name: catName, value: userValue, ratioStr, splitResult };
      });

      setExpenseData(expenseArr);
      setIncomeData(incomeArr);
    };

    return () => {
      unsubTx();
      unsubFc();
    };
  }, [selectedYear, categoryMap, currentUser]);

  // 固定収支のデータを選択年内で展開する関数
  // frequency が "monthly"、"weekly"、"yearly" に対応
  function expandFixedCosts(allFcItems, year) {
    let result = [];
    const today = new Date();
    const isCurrentYear = year === today.getFullYear();
    allFcItems.forEach((fc) => {
      if (!fc.date || !fc.frequency) {
        result.push({
          ...fc,
          date: fc.date,
          amount: fc.amount,
          creatorId: fc.creatorId || fc.userId,
        });
        return;
      }
      if (fc.frequency === "monthly") {
        const [startY, startM, startD] = fc.date.split("-");
        const day = parseInt(startD, 10) || 1;
        let dt = new Date(parseInt(startY, 10), parseInt(startM, 10) - 1, day);
        while (dt.getFullYear() === year && (!isCurrentYear || dt <= today)) {
          // ...（以下は既存の処理と同じ）
          const y = dt.getFullYear();
          const m = dt.getMonth() + 1;
          const dd = ("0" + Math.min(day, daysInMonth(y, m))).slice(-2);
          const mm = ("0" + m).slice(-2);
          const newDateStr = `${y}-${mm}-${dd}`;
          result.push({
            ...fc,
            date: newDateStr,
            amount: fc.amount,
            creatorId: fc.creatorId || fc.userId,
          });
          dt.setMonth(dt.getMonth() + 1);
        }
      } else if (fc.frequency === "weekly") {
        const [startY, startM, startD] = fc.date.split("-");
        const startDay = parseInt(startD, 10) || 1;
        let dt = new Date(parseInt(startY, 10), parseInt(startM, 10) - 1, startDay);
        while (dt.getFullYear() === year && (!isCurrentYear || dt <= today)) {
          const y = dt.getFullYear();
          const m = dt.getMonth() + 1;
          const d = dt.getDate();
          const dd = ("0" + d).slice(-2);
          const mm = ("0" + m).slice(-2);
          const newDateStr = `${y}-${mm}-${dd}`;
          result.push({
            ...fc,
            date: newDateStr,
            amount: fc.amount,
            creatorId: fc.creatorId || fc.userId,
          });
          dt.setDate(dt.getDate() + 7);
        }
      } else if (fc.frequency === "yearly") {
        const [startY, startM, startD] = fc.date.split("-");
        const day = parseInt(startD, 10) || 1;
        let dt = new Date(parseInt(startY, 10), parseInt(startM, 10) - 1, day);
        while (dt.getFullYear() === year && (!isCurrentYear || dt <= today)) {
          const y = dt.getFullYear();
          const m = dt.getMonth() + 1;
          const dd = ("0" + Math.min(day, daysInMonth(y, m))).slice(-2);
          const mm = ("0" + m).slice(-2);
          const newDateStr = `${y}-${mm}-${dd}`;
          result.push({
            ...fc,
            date: newDateStr,
            amount: fc.amount,
            creatorId: fc.creatorId || fc.userId,
          });
          dt.setFullYear(dt.getFullYear() + 1);
        }
      } else {
        result.push({
          ...fc,
          date: fc.date,
          amount: fc.amount,
          creatorId: fc.creatorId || fc.userId,
        });
      }
    });
    return result;
  }
  

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // 比率分割の表示用文字列
  function computeSplit(total, ratioStr) {
    if (!ratioStr || ratioStr === "none") return null;
    const parts = ratioStr.split(":");
    if (parts.length !== 2) return null;
    const a = parseFloat(parts[0]);
    const b = parseFloat(parts[1]);
    if (!a || !b) return null;
    const sum = a + b;
    const part1 = Math.round((total * a) / sum);
    const part2 = Math.round((total * b) / sum);
    return `${part1.toLocaleString("en-US")} / ${part2.toLocaleString("en-US")}`;
  }

  // ▼ 円グラフ用生データ
  const rawData = viewMode === "expense" ? expenseData : incomeData;
  const sumValue = rawData.reduce((acc, it) => acc + it.value, 0);

  // 5% 未満を +α にまとめ
  let plusAlphaValue = 0;
  const tmp = [];
  rawData.forEach((it) => {
    const percent = sumValue === 0 ? 0 : (it.value / sumValue) * 100;
    if (percent < 5) {
      plusAlphaValue += it.value;
    } else {
      tmp.push(it);
    }
  });
  if (plusAlphaValue > 0) {
    tmp.push({ name: "+α", value: plusAlphaValue });
  }
  tmp.sort((a, b) => b.value - a.value);

  const chartData = tmp.map((it, idx) => {
    const pct = sumValue === 0 ? 0 : (it.value / sumValue) * 100;
    return { ...it, percent: pct, idx };
  });

  // 合計 (比率反映後)
  const totalExpense = expenseData.reduce((acc, it) => acc + it.value, 0);
  const totalIncome = incomeData.reduce((acc, it) => acc + it.value, 0);
  const netBalance = totalIncome - totalExpense;

  // ▼ 年の選択肢
  const yearOptions = Array.from({ length: 11 }, (_, i) => 2020 + i);

  return (
    <div>
      {/* 年選択 */}
      <div className="mb-4">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="border rounded px-2 py-1 bg-white text-gray-700"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      {/* 支出 / 収入 切り替え */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode("expense")}
          className={`px-4 py-2 rounded ${
            viewMode === "expense"
              ? "bg-[rgba(240,172,117,0.54)] text-black"
              : "bg-gray-300"
          }`}
        >
          支出
        </button>
        <button
          onClick={() => setViewMode("income")}
          className={`px-4 py-2 rounded ${
            viewMode === "income"
              ? "bg-[rgba(240,172,117,0.54)] text-black"
              : "bg-gray-300"
          }`}
        >
          収入
        </button>
      </div>

      {/* 円グラフ */}
      {chartData.length === 0 ? (
        <p>{viewMode === "expense" ? "支出データがありません" : "収入データがありません"}</p>
      ) : (
        <PieChart width={300} height={150} className="mx-auto">
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={45}
            startAngle={90}
            endAngle={-270}
            labelLine
            label={renderLabel}
          >
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={getColor(idx)} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      )}

      {/* +α まとめ後の一覧 */}
      <ul className="mt-2">
        {chartData.map((item, idx) => (
          <li key={item.name} className="flex items-center w-full">
            <span
              className="inline-block w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: getColor(idx) }}
            />
            <span className="text-gray-700">{item.name}</span>
            <div className="ml-auto flex items-center whitespace-nowrap">
              <span className="w-16 text-right">{item.value.toLocaleString()}</span>
              <span className="ml-1">円</span>
            </div>
          </li>
        ))}
      </ul>

      {/* 合計 */}
      <div className="flex gap-14 justify-start mt-4 text-lg font-bold">
        <div>収入: {totalIncome.toLocaleString()}円</div>
        <div>支出: {totalExpense.toLocaleString()}円</div>
      </div>
      <div className="mt-4 text-lg font-bold">
        貯蓄:{" "}
        <span className={netBalance >= 0 ? "text-green-600" : "text-red-600"}>
          {netBalance.toLocaleString()}円
        </span>
      </div>
    </div>
  );
};

/** 円グラフラベル: % 表示 */
function renderLabel(entry) {
  const p = entry.percent.toFixed(1);
  return `${p}%`;
}

/** カラーパレット */
function getColor(idx) {
  const colors = [
    "#48d1cc",
    "#82ca9d",
    "#ffc658",
    "#ff7f7f",
    "#a4de6c",
    "#d0ed57",
    "#ff8c00",
    "#6a5acd",
    "#20b2aa",
    "#ff1493",
    "#00ced1",
    "#dc143c",
    "#4682b4",
    "#32cd32",
    "#ff4500",
    "#9370db",
    "#b22222",
    "#ffb6c1",
    "#8b4513",
    "#2e8b57",
  ];
  return colors[idx % colors.length];
}

export default YearlyReport;
