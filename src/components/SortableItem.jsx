// SortableItem.jsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableItem({ cat, isEditing, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-gray-50 p-2 rounded border border-gray-200 cursor-move select-none"
    >
      {/* ここに削除ボタンや比率編集などのUI */}
      {cat.name}
    </div>
  );
}
