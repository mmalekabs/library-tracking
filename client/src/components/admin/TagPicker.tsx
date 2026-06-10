import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { arabicSearchEquals } from "@/utils/arabicSearch";
import { inputClass } from "./FormSection";

interface Tag {
  id: string;
  name: string;
}

interface TagPickerProps {
  label: string;
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
  queryKey: string;
  fetchFn: (search: string) => Promise<Tag[]>;
}

export function TagPicker({
  label,
  tags,
  onChange,
  queryKey,
  fetchFn,
}: TagPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: options = [] } = useQuery({
    queryKey: [queryKey, search],
    queryFn: () => fetchFn(search),
    enabled: open,
  });

  const addTag = (tag: Tag) => {
    if (!tags.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())) {
      onChange([...tags, tag]);
    }
    setSearch("");
    setOpen(false);
  };

  const removeTag = (name: string) => {
    onChange(tags.filter((t) => t.name !== name));
  };

  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mb-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.name}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
            dir="auto"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.name)}
              className="text-gray-500 hover:text-red-600"
              aria-label={`Remove ${tag.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Add…"
          className={inputClass}
          dir="auto"
        />
        {open && search.trim() && (
          <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg">
            {options
              .filter(
                (o) =>
                  !tags.some(
                    (t) => t.name.toLowerCase() === o.name.toLowerCase(),
                  ),
              )
              .map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    dir="auto"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(opt);
                    }}
                  >
                    {opt.name}
                  </button>
                </li>
              ))}
            {!options.some(
              (o) => arabicSearchEquals(o.name, search.trim()),
            ) && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-gray-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag({ id: "", name: search.trim() });
                  }}
                >
                  Create “{search.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
