import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface SelectMenuProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  triggerClassName,
  menuClassName,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className ? `select-menu ${className}` : "select-menu"}>
      <button
        type="button"
        className={triggerClassName ? `select-menu-trigger ${triggerClassName}` : "select-menu-trigger"}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="select-menu-value">{selectedOption?.label ?? ""}</span>
        <ChevronDown size={14} className={`select-menu-chevron ${open ? "is-open" : ""}`} />
      </button>

      {open ? (
        <div id={listboxId} className={menuClassName ? `select-menu-list ${menuClassName}` : "select-menu-list"} role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className={`select-menu-option ${option.value === value ? "is-selected" : ""}`}
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
