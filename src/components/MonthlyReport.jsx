// src/components/MonthlyReport.jsx

import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import CategoryDetailModal from "./CategoryDetailModal";
import { useAuth } from "../context/AuthContext";

const MonthlyReport = ({ onEditTransaction }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [expenseData, setExpenseData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [viewMode, setViewMode] = useState("expense");
  const [categoryMap, setCategoryMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);

  const { currentUser } = useAuth();

  const SEIJI_UID = "yyJaRrazbhdHGXx702LyKJss8zX2";
  const HANA_UID = "bRpkMFGXuZNbk8Hm78Wbv8IhJII2";
  const isUser1 = currentUser?.uid === SEIJI_UID;

  const [seijiCost, setSeijiCost] = useState(0);
  const [hanaCost, setHanaCost] = useState(0);

  // ▼ カテゴリ情報取得
  useEffect(() => {
    if (!currentUser) return;
    const qCat = query(collection(db, "categories"));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const map = {};
      snapshot.docs.forEach((doc) => {
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

  // ▼ 取引データと固定収支を取得し、合体して集計
  useEffect(() => {
    if (!currentUser) return;
    const qTx = query(collection(db, "transactions"));
    const qFc = query(collection(db, "fixedCosts"));

    let allTxItems = [];
    let allFcItems = [];

    const unsubTx = onSnapshot(qTx, (snapshot) => {
      allTxItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      combineAndCompute();
    });
    const unsubFc = onSnapshot(qFc, (snapshot) => {
      allFcItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      combineAndCompute();
    });

    const combineAndCompute = () => {
      // ▼ 固定収支のデータを開始日および編集履歴に基づき、選択された月内で展開する
      const expandedFixedCosts = expandFixedCosts(allFcItems, selectedYear, selectedMonth);
      // ▼ 物理取引と展開した固定収支を合体
      const combined = [...allTxItems, ...expandedFixedCosts];

      // ▼ カテゴリ共有判定
      const filteredByShare = combined.filter((it) => {
        if (!categoryMap[it.category]) return it.userId === currentUser.uid;
        return categoryMap[it.category].ratio !== "none" ? true : it.userId === currentUser.uid;
      });

      // ▼ 月別フィルタ (日付は "YYYY-MM-DD" 形式)
      const filtered = filteredByShare.filter((it) => {
        if (!it.date) return false;
        const [y, m] = it.date.split("-");
        return parseInt(y, 10) === selectedYear && parseInt(m, 10) === selectedMonth;
      });

      const expenseItems = filtered.filter((it) => it.type === "expense");
      const incomeItems = filtered.filter((it) => it.type === "income");

      const expenseMap = {};
      expenseItems.forEach((it) => {
        // 固定収支の場合、キーを「固定支出」とする
        const key = it.frequency ? "固定支出" : it.category;
        if (!expenseMap[key]) expenseMap[key] = 0;
        expenseMap[key] += it.amount;
      });

      const incomeMap = {};
      incomeItems.forEach((it) => {
        if (!incomeMap[it.category]) incomeMap[it.category] = 0;
        incomeMap[it.category] += it.amount;
      });

      const expenseArr = Object.keys(expenseMap).map((catName) => {
        const total = expenseMap[catName];
        const ratioStr = categoryMap[catName]?.ratio || "none";
        let userValue = total;
        if (ratioStr !== "none") {
          const [aStr, bStr] = ratioStr.split(":");
          const a = parseFloat(aStr);
          const b = parseFloat(bStr);
          if (a && b) {
            const ratioToUse = isUser1 ? a : b;
            userValue = Math.round((total * ratioToUse) / (a + b));
          }
        }
        return { name: catName, value: userValue, ratioStr, splitResult: computeSplit(total, ratioStr) };
      });

      const incomeArr = Object.keys(incomeMap).map((catName) => {
        const total = incomeMap[catName];
        const ratioStr = categoryMap[catName]?.ratio || "none";
        let userValue = total;
        if (ratioStr !== "none") {
          const [aStr, bStr] = ratioStr.split(":");
          const a = parseFloat(aStr);
          const b = parseFloat(bStr);
          if (a && b) {
            const ratioToUse = isUser1 ? a : b;
            userValue = Math.round((total * ratioToUse) / (a + b));
          }
        }
        return { name: catName, value: userValue, ratioStr, splitResult: computeSplit(total, ratioStr) };
      });

      setExpenseData(expenseArr);
      setIncomeData(incomeArr);

      let seijiSum = 0;
      let hanaSum = 0;
      expenseItems.forEach((tx) => {
        const ratio = categoryMap[tx.category]?.ratio;
        if (!ratio || ratio === "none") return;
        const [aStr, bStr] = ratio.split(":");
        const a = parseFloat(aStr);
        const b = parseFloat(bStr);
        if (!a || !b) return;
        if (tx.creatorId === SEIJI_UID) {
          const cost = Math.round((tx.amount * b) / (a + b));
          seijiSum += cost;
        } else if (tx.creatorId === HANA_UID) {
          const cost = Math.round((tx.amount * a) / (a + b));
          hanaSum += cost;
        }
      });
      setSeijiCost(seijiSum);
      setHanaCost(hanaSum);
    };

    return () => {
      unsubTx();
      unsubFc();
    };
  }, [selectedYear, selectedMonth, categoryMap, currentUser]);

  // ── 固定収支の編集履歴に対応した展開処理 ──
  // 期間ごとに固定収支の amount を変更できるように、初期設定(fc.date)と編集履歴(fc.revisions)から各期間を決定し、
  // その期間内で週/月/年ごとにレコードを生成する
  function expandFixedCosts(allFcItems, year, month) {
    let result = [];
    // レポート対象の月の期間
    const reportStart = new Date(year, month - 1, 1);
    const reportEnd = new Date(year, month, 0); // 選択月の最終日
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
      // 初期設定期間
      let periods = [{ start: fc.date, amount: fc.amount }];
      // 編集履歴 (revisions) があれば追加
      if (fc.revisions && Array.isArray(fc.revisions)) {
        let revs = fc.revisions.slice();
        revs.sort((a, b) => new Date(a.reflectDate) - new Date(b.reflectDate));
        revs.forEach((r) => periods.push({ start: r.reflectDate, amount: r.amount }));
      }
      periods.sort((a, b) => new Date(a.start) - new Date(b.start));

      // 各期間について、レポート対象月との交差部分で発生する各固定収支を展開する
      for (let i = 0; i < periods.length; i++) {
        let periodStartDate = new Date(periods[i].start);
        let periodAmount = periods[i].amount;
        let periodEndDate =
          i < periods.length - 1
            ? new Date(new Date(periods[i + 1].start).getTime() - 24 * 60 * 60 * 1000)
            : reportEnd;
        // レポート対象月との交差部分
        let effectiveStart = periodStartDate < reportStart ? reportStart : periodStartDate;
        let effectiveEnd = periodEndDate > reportEnd ? reportEnd : periodEndDate;
        if (effectiveStart > effectiveEnd) continue;

        if (fc.frequency === "monthly") {
          const originalDay = parseInt(fc.date.split("-")[2], 10) || 1;
          let dt = new Date(effectiveStart);
          dt.setDate(originalDay);
          if (dt < effectiveStart) {
            dt.setMonth(dt.getMonth() + 1);
          }
          while (dt <= effectiveEnd) {
            const y = dt.getFullYear();
            const m = dt.getMonth() + 1;
            const dd = ("0" + Math.min(originalDay, daysInMonth(y, m))).slice(-2);
            const mm = ("0" + m).slice(-2);
            const newDateStr = `${y}-${mm}-${dd}`;
            result.push({
              ...fc,
              date: newDateStr,
              amount: periodAmount,
              creatorId: fc.creatorId || fc.userId,
            });
            dt.setMonth(dt.getMonth() + 1);
          }
        } else if (fc.frequency === "weekly") {
          let dt = new Date(fc.date);
          while (dt < effectiveStart) {
            dt.setDate(dt.getDate() + 7);
          }
          while (dt <= effectiveEnd) {
            const y = dt.getFullYear();
            const m = dt.getMonth() + 1;
            const d = dt.getDate();
            const dd = ("0" + d).slice(-2);
            const mm = ("0" + m).slice(-2);
            const newDateStr = `${y}-${mm}-${dd}`;
            result.push({
              ...fc,
              date: newDateStr,
              amount: periodAmount,
              creatorId: fc.creatorId || fc.userId,
            });
            dt.setDate(dt.getDate() + 7);
          }
        } else if (fc.frequency === "yearly") {
          const originalDay = parseInt(fc.date.split("-")[2], 10) || 1;
          let dt = new Date(fc.date);
          while (dt < effectiveStart) {
            dt.setFullYear(dt.getFullYear() + 1);
          }
          while (dt <= effectiveEnd) {
            const y = dt.getFullYear();
            const m = dt.getMonth() + 1;
            const dd = ("0" + Math.min(originalDay, daysInMonth(y, m))).slice(-2);
            const mm = ("0" + m).slice(-2);
            const newDateStr = `${y}-${mm}-${dd}`;
            result.push({
              ...fc,
              date: newDateStr,
              amount: periodAmount,
              creatorId: fc.creatorId || fc.userId,
            });
            dt.setFullYear(dt.getFullYear() + 1);
          }
        }
      }
    });
    return result;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function computeSplit(total, ratioStr) {
    if (!ratioStr || ratioStr === "none") return null;
    const parts = ratioStr.split(":");
    if (parts.length !== 2) return null;
    const a = parseFloat(parts[0]);
    const b = parseFloat(parts[1]);
    if (!a || !b) return null;
    const sum = a + b;
    const p1 = Math.round((total * a) / sum);
    const p2 = Math.round((total * b) / sum);
    return `${p1.toLocaleString()} / ${p2.toLocaleString()}`;
  }

  const rawData = viewMode === "expense" ? expenseData : incomeData;
  const sumValue = rawData.reduce((acc, it) => acc + it.value, 0);

  let plusAlphaValue = 0;
  const plusAlphaNames = [];
  const tmp = [];
  rawData.forEach((it) => {
    const pct = sumValue === 0 ? 0 : (it.value / sumValue) * 100;
    if (pct < 5) {
      plusAlphaValue += it.value;
      plusAlphaNames.push(it.name);
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
    return { ...it, percent: pct };
  });

  const totalExpense = expenseData.reduce((acc, it) => acc + it.value, 0);
  const totalIncome = incomeData.reduce((acc, it) => acc + it.value, 0);
  const netBalance = totalIncome - totalExpense;

  const diff = Math.abs(seijiCost - hanaCost);
  let extraMessage = "";
  if (diff > 0) {
    extraMessage =
      seijiCost > hanaCost
        ? `はながせいじに ${diff.toLocaleString()}円支払ってください`
        : `せいじがはなに ${diff.toLocaleString()}円支払ってください`;
  }

  const listingData = [...rawData];
  listingData.sort((a, b) => b.value - a.value);

  const yearOptions = Array.from({ length: 11 }, (_, i) => 2020 + i);

  return (
    <div>
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
        <button
          type="button"
          onClick={() => setSelectedMonth((prev) => Math.max(prev - 1, 1))}
          className="px-2 py-1 bg-white"
        >
          ＜
        </button>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          className="border rounded px-2 py-1 bg-white text-gray-700"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSelectedMonth((prev) => Math.min(prev + 1, 12))}
          className="px-2 py-1 bg-white"
        >
          ＞
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
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
          type="button"
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
      {chartData.length === 0 ? (
        <p>
          {viewMode === "expense"
            ? "支出データがありません"
            : "収入データがありません"}
        </p>
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
      <ul className="mt-2">
        {listingData.map((item, idx) => {
          let color = getColor(idx);
          if (plusAlphaValue > 0 && plusAlphaNames.includes(item.name)) {
            const alphaIdx = chartData.findIndex((d) => d.name === "+α");
            if (alphaIdx >= 0) color = getColor(alphaIdx);
          }
          return (
            <li key={item.name} className="flex items-center w-full">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: color }}
              />
              <button
                type="button"
                onClick={() => setSelectedCategory(item)}
                className="px-3 rounded bg-white text-black"
              >
                {item.name}
              </button>
              <div className="ml-auto flex items-center whitespace-nowrap">
                <span className="w-16 text-right">
                  {item.value.toLocaleString()}
                </span>
                <span className="ml-1">円</span>
              </div>
            </li>
          );
        })}
      </ul>
      {extraMessage && (
        <div className="text-[rgba(58,124,110,0.64)] text-lg mt-2 font-bold">
          {extraMessage}
        </div>
      )}
      <div className="flex gap-14 justify-start mt-2 text-lg font-bold">
        <div>収入: {totalIncome.toLocaleString()}円</div>
        <div>支出: {totalExpense.toLocaleString()}円</div>
      </div>
      <div className="text-lg font-bold">
        貯蓄:{" "}
        <span className={netBalance >= 0 ? "text-green-600" : "text-red-600"}>
          {netBalance.toLocaleString()}円
        </span>
      </div>
      {selectedCategory && (
        <CategoryDetailModal
          categoryName={selectedCategory.name}
          ratioStr={selectedCategory.ratioStr}
          year={selectedYear}
          month={selectedMonth}
          onClose={() => setSelectedCategory(null)}
          onEditTransaction={onEditTransaction}
        />
      )}
    </div>
  );
};

function renderLabel(entry) {
  const p = entry.percent.toFixed(1);
  return `${p}%`;
}

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

export default MonthlyReport;
