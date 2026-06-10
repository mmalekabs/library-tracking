import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { arabicSearchEquals } from "@/utils/arabicSearch";
import { inputClass } from "./FormSection";

interface EntityPickerProps {
  label: string;
  required?: boolean;
  value: { id: string; name: string };
  onChange: (value: { id: string; name: string }) => void;
  queryKey: string;
  fetchFn: (search: string) => Promise<{ id: string; name: string }[]>;
  placeholder?: string;
}

export function EntityPicker({
  label,
  required,
  value,
  onChange,
  queryKey,
  fetchFn,
  placeholder = "Search or type a new name…",
}: EntityPickerProps) {
  const [search, setSearch] = useState(value.name);
  const [open, setOpen] = useState(false);

  const { data: options = [] } = useQuery({
    queryKey: [queryKey, search],
    queryFn: () => fetchFn(search),
    enabled: open,
  });

  const handleInput = (text: string) => {
    setSearch(text);
    onChange({ id: "", name: text });
    setOpen(true);
  };

  const selectOption = (opt: { id: string; name: string }) => {
    setSearch(opt.name);
    onChange(opt);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type="text"
        value={search}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputClass}
        dir="auto"
        required={required && !value.name.trim()}
      />
      {open && (options.length > 0 || search.trim()) && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                dir="auto"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt);
                }}
              >
                {opt.name}
              </button>
            </li>
          ))}
          {search.trim() &&
            !options.some(
              (o) =>
                arabicSearchEquals(o.name, search.trim()),
            ) && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-gray-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption({ id: "", name: search.trim() });
                  }}
                >
                  Create “{search.trim()}”
                </button>
              </li>
            )}
        </ul>
      )}
    </div>
  );
}
