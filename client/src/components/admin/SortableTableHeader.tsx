import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

interface SortableTableHeaderProps {
  label: string;
  active: boolean;
  sortOrder: "asc" | "desc";
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function SortableTableHeader({
  label,
  active,
  sortOrder,
  onClick,
  className = "",
  style,
}: SortableTableHeaderProps) {
  const Icon = active
    ? sortOrder === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th className={className} style={style}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-gray-800 ${
          active ? "text-primary" : ""
        }`}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
    </th>
  );
}
