import { useEffect, useRef, useState } from 'react';

interface SearchableOption {
  label: string;
  value: string | number;
}

interface SearchableSelectProps {
  disabled?: boolean;
  emptyMessage?: string;
  onAdd?: () => void;
  onChange: (value: any) => void;
  options: SearchableOption[];
  placeholder?: string;
  value: any;
}

/**
 * SearchableSelect
 * * A combobox component that allows inline typing to filter options.
 * * Reverts to the selected value on blur.
 */
export default function SearchableSelect({
  disabled = false,
  emptyMessage = "No options found",
  onAdd,
  onChange,
  options,
  placeholder = "Select an option...",
  value
}: SearchableSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const isEmpty = options.length === 0;

  // Handles clicking outside to close and revert the search input
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch(""); 
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o) => 
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Dynamic Display Logic: Show search text when open, otherwise show the selected label
  const displayValue = isOpen ? search : (selectedOption ? selectedOption.label : "");
  // Dynamic Placeholder: When typing, use the selected label as the placeholder so context isn't lost
  const activePlaceholder = selectedOption ? selectedOption.label : placeholder;

  return (
    <div style={{ alignItems: "center", display: "flex", gap: "8px", width: "100%" }}>
      <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
        
        <input
          disabled={disabled || isEmpty}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onClick={() => {
            if (!disabled && !isEmpty) setIsOpen(true);
          }}
          placeholder={isEmpty ? emptyMessage : activePlaceholder}
          value={displayValue}
          style={{
            background: disabled ? "#1e293b" : "#0f172a",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: isEmpty || disabled ? "#64748b" : "#f1f5f9",
            cursor: isEmpty || disabled ? "not-allowed" : "text",
            fontSize: "13px",
            outline: isOpen ? "2px solid #3b82f6" : "none",
            padding: "10px 12px",
            width: "100%",
            boxSizing: "border-box"
          }}
        />
        
        <span style={{ color: "#64748b", fontSize: "10px", position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          {isOpen ? "▲" : "▼"}
        </span>

        {isOpen && !isEmpty && !disabled && (
          <div style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "6px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            left: 0,
            maxHeight: "250px",
            marginTop: "4px",
            position: "absolute",
            right: 0,
            top: "100%",
            zIndex: 9999
          }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {filteredOptions.length > 0 ? filteredOptions.map((o) => (
                <div
                  key={o.value}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onChange(o.value); 
                    setIsOpen(false); 
                    setSearch(""); 
                  }}
                  style={{ 
                    background: String(value) === String(o.value) ? "#334155" : "transparent", 
                    color: "#e2e8f0", 
                    cursor: "pointer", 
                    fontSize: "13px", 
                    padding: "10px 12px",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#334155"}
                  onMouseLeave={(e) => e.currentTarget.style.background = String(value) === String(o.value) ? "#334155" : "transparent"}
                >
                  {o.label}
                </div>
              )) : (
                <div style={{ color: "#64748b", fontSize: "13px", padding: "10px 12px" }}>
                  No matches found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {onAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          style={{ alignItems: "center", background: "#3b82f6", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", display: "flex", flexShrink: 0, fontSize: "18px", fontWeight: "bold", height: "38px", justifyContent: "center", width: "38px" }}
          title="Add New"
          type="button"
        >
          +
        </button>
      )}
    </div>
  );
}