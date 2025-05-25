// src/components/CategoryPicker.jsx

import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
  where,
  getDocs,
  orderBy,
  getDoc,
  setDoc,
} from "firebase/firestore";

// ========== DnD Kit ==========
import { DndContext, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** 
 * カテゴリ１つ分を「ドラッグ可能な要素」として定義するコンポーネント。
 * useSortable({ id: cat.id }) で、この要素をドラッグ可能にする。
 */
function SortableCategoryItem({
  cat,
  selectedCategory,
  onSelectCategory,
  onEditStart,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  // スタイルを適用（ドラッグ時の透過度を調整）
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    userSelect: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-50 p-2 rounded border border-gray-200 flex flex-col gap-1"
    >
      {/* カテゴリ名のボタン */}
      <button
        type="button"
        onClick={() => onSelectCategory(cat.name)}
        className={`px-3 py-1 rounded-md border ${
          selectedCategory === cat.name
            ? "bg-gray-300 text-gray-700 border-gray-400"
            : "bg-white text-gray-700 border-gray-300"
        }`}
      >
        {cat.name}
      </button>

      {/* 右詰のアイテム配置 */}
      <div className="text-sm text-gray-600 flex items-center justify-end">
        {/* 比率（固定幅） */}
        <span className="min-w-[50px] text-right">
          {cat.ratio && cat.ratio !== "none" ? cat.ratio : ""}
        </span>

        {/* ペンボタン（中央） */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // 並べ替えを防ぐ
            onEditStart(cat);
          }}
          className="ml-2 text-[rgb(240,172,117)]"
        >
          🖊
        </button>

        {/* 並べ替えボタン（右端） */}
        <div {...attributes} {...listeners} className="cursor-grab px-2 ml-2">
          ☰
        </div>
      </div>
    </div>
  );
}



export default function CategoryPicker({
  selectedCategory,
  onSelectCategory,
  categoryType, // "expense" or "income"
  showAddForm,
}) {
  const { currentUser } = useAuth();

  const [categories, setCategories] = useState([]);

  // 新規カテゴリ追加用
  const [newCategoryName, setNewCategoryName] = useState("");
  const [partA, setPartA] = useState("");
  const [partB, setPartB] = useState("");

  // 既存カテゴリの比率編集用
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingPartA, setEditingPartA] = useState("");
  const [editingPartB, setEditingPartB] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // ========= カテゴリ一覧を取得（snapshot） =========
  useEffect(() => {
    if (!currentUser) return;
  
    const qAll = query(
      collection(db, "categories"),
      orderBy("name", "asc") // 名前順
    );
  
    const unsubscribe = onSnapshot(qAll, async (snapshot) => {
      const allCats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      // カテゴリのフィルタリング
      const filtered = allCats.filter((cat) => {
        if (cat.type !== categoryType) return false;
        if (!cat.ratio || cat.ratio === "none") {
          return cat.userId === currentUser.uid;
        }
        return true;
      });
  
      // Firestore からユーザーの保存した順序情報を取得
      const orderRef = doc(db, "users", currentUser.uid, "preferences", "categoryOrder");
      const orderSnap = await getDoc(orderRef);
      const storedOrder = orderSnap.exists() ? orderSnap.data()[`${categoryType}Order`] || [] : [];
  
      // 並び替え
      let sortedCategories = filtered;
      if (storedOrder.length) {
        sortedCategories = storedOrder
          .map((id) => filtered.find((cat) => cat.id === id))
          .filter(Boolean);
      }
  
      console.log("Firestoreから取得したカテゴリリスト:", sortedCategories);
      setCategories(sortedCategories);
    });
  
    return () => unsubscribe();
  }, [categoryType, currentUser]);
  
  

  // ========= 新規カテゴリ追加 =========
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    let ratio = "none";
    if (partA.trim() && partB.trim()) {
      ratio = `${partA}:${partB}`;
    }
  
    try {
      const docRef = await addDoc(collection(db, "categories"), {
        name: newCategoryName.trim(),
        type: categoryType,
        ratio,
        userId: currentUser.uid,
      });
  
      // Firestoreのリアルタイム更新を待たずにローカルにも追加
      setCategories((prev) => [
        ...prev,
        {
          id: docRef.id,
          name: newCategoryName.trim(),
          type: categoryType,
          ratio,
          userId: currentUser.uid,
        },
      ]);
  
      console.log("カテゴリ追加:", newCategoryName.trim());
  
      setNewCategoryName("");
      setPartA("");
      setPartB("");
    } catch (error) {
      console.error("カテゴリ追加エラー:", error);
    }
  };
  
  

  // ========= カテゴリ削除 =========
  const handleDeleteCategory = async (id, name) => {
    const ok = window.confirm(`「${name}」を削除しますか？`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (error) {
      console.error("カテゴリ削除エラー:", error);
    }
  };

  // ========= 比率編集を開始 =========
  const startEditRatio = (cat) => {
    setEditingCatId(cat.id);
    setEditingCategoryName(cat.name);
    if (cat.ratio && cat.ratio !== "none") {
      const [a, b] = cat.ratio.split(":");
      setEditingPartA(a || "");
      setEditingPartB(b || "");
    } else {
      setEditingPartA("");
      setEditingPartB("");
    }
  };

  // ========= 編集内容の保存 & 取引のカテゴリ名更新 (batch) =========
  const saveEditRatioAndName = async () => {
    if (!editingCatId) return;
    let ratio = "none";
    if (editingPartA.trim() && editingPartB.trim()) {
      ratio = `${editingPartA}:${editingPartB}`;
    }
    // 対象カテゴリ
    const targetCat = categories.find((cat) => cat.id === editingCatId);
    const oldCategoryName = targetCat ? targetCat.name : "";

    try {
      await updateDoc(doc(db, "categories", editingCatId), {
        ratio,
        name: editingCategoryName,
      });
      // カテゴリ名が変わったときは取引レコードを更新
      if (oldCategoryName && oldCategoryName !== editingCategoryName) {
        const q = query(
          collection(db, "transactions"),
          where("category", "==", oldCategoryName),
          where("userId", "==", currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { category: editingCategoryName });
        });
        await batch.commit();
      }
      setEditingCatId(null);
      setEditingCategoryName("");
      setEditingPartA("");
      setEditingPartB("");
    } catch (error) {
      console.error("カテゴリ更新エラー:", error);
    }
  };

  // ========= DnD kit：ドラッグ終了時の処理 =========
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // 現在の配列で、ドラッグ中の要素 / 重ねられた要素の位置を確認
    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return; // 念のため

    // 配列を再並べ替え
    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    // 🔹 Firestore に並び順を保存
    try {
      const orderRef = doc(db, "users", currentUser.uid, "preferences", "categoryOrder");
      await setDoc(
        orderRef,
        { [`${categoryType}Order`]: newCategories.map((cat) => cat.id) },
        { merge: true }
      );
    } catch (error) {
      console.error("Firestore への並び順の保存エラー:", error);
    }
  };

  // ========= レンダリング =========
  const isEditingCat = (cat) => cat.id === editingCatId;
  const editingCat = categories.find((cat) => cat.id === editingCatId);

  return (
    <div className="space-y-3">
      {/* DnD kit コンテナ */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {/* 垂直リストの並べ替え設定 */}
        <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="max-h-[200px] overflow-y-auto grid grid-cols-2 gap-2">
            {categories.map((cat) => {
              // 編集中なら編集UIを表示
              if (isEditingCat(cat)) {
                return (
                  <div
                    key={cat.id}
                    className="bg-gray-50 p-2 rounded border border-gray-200 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="px-3 py-1 rounded-md border bg-white text-gray-700 border-gray-300 w-[80px]"
                        />
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="text-red-500 hover:text-red-700 text-sm p-1"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editingPartA}
                          onChange={(e) => setEditingPartA(e.target.value)}
                          className="w-8 border border-gray-300 rounded px-1 text-gray-700"
                        />
                        <span>:</span>
                        <input
                          type="number"
                          value={editingPartB}
                          onChange={(e) => setEditingPartB(e.target.value)}
                          className="w-8 border border-gray-300 rounded px-1 text-gray-700 "
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveEditRatioAndName}
                        className="bg-[rgba(240,172,117,0.54)] text-black px-1 py-1 rounded hover:bg-[rgb(216,156,107)]"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                );
              } else {
                // 通常表示：Sortableな要素として表示（削除ボタンは表示しない）
                return (
                  <SortableCategoryItem
                    key={cat.id}
                    cat={cat}
                    selectedCategory={selectedCategory}
                    onSelectCategory={onSelectCategory}
                    onEditStart={startEditRatio}
                  />
                );
              }
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* 新規カテゴリ追加フォーム */}
      {showAddForm && (
        <div className="bg-gray-50 p rounded border border-gray-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="カテゴリ名"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="border border-gray-300 rounded-md px-1 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-white-400"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="A"
                  value={partA}
                  onChange={(e) => setPartA(e.target.value)}
                  className="w-12 border border-gray-300 rounded px-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-white-400"
                />
                <span>:</span>
                <input
                  type="number"
                  placeholder="B"
                  value={partB}
                  onChange={(e) => setPartB(e.target.value)}
                  className="w-12 border border-gray-300 rounded px^-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddCategory}
              className="bg-gray-200 text-gray-700 px py-2 rounded-md hover:bg-gray-300 transition  mt"
            >
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
