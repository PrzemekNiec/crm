import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent) => void;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      options,
      placeholder,
      id,
      name,
      disabled,
      value: controlledValue,
      defaultValue,
      onChange,
      onBlur,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const hiddenRef = useRef<HTMLSelectElement | null>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);

    // Sync with react-hook-form's ref-based value
    useEffect(() => {
      if (!hiddenRef.current) return;
      const observer = new MutationObserver(() => {
        const refVal = hiddenRef.current?.value;
        if (refVal != null && refVal !== internalValue) {
          setInternalValue(refVal);
        }
      });
      observer.observe(hiddenRef.current, { attributes: true, childList: true });
      // Also sync initial value
      const refVal = hiddenRef.current.value;
      if (refVal && refVal !== internalValue) {
        setInternalValue(refVal);
      }
      return () => observer.disconnect();
    }, []);

    const currentValue = controlledValue ?? internalValue;
    const selectedOption = options.find((o) => o.value === currentValue);

    // Sync forwarded ref with hidden select
    const setRefs = useCallback(
      (el: HTMLSelectElement | null) => {
        hiddenRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref)
          (ref as React.MutableRefObject<HTMLSelectElement | null>).current = el;
      },
      [ref]
    );

    // Calculate position when opening
    const updatePos = useCallback(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }, []);

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          containerRef.current &&
          !containerRef.current.contains(target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(target)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open]);

    const handleToggle = () => {
      if (disabled) return;
      if (!open) updatePos();
      setOpen((v) => !v);
    };

    const handleSelect = (optValue: string) => {
      setInternalValue(optValue);
      setOpen(false);

      // Fire synthetic change event on hidden select for react-hook-form
      const hiddenSelect = hiddenRef.current;
      if (hiddenSelect && onChange) {
        const nativeSet = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value"
        )?.set;
        nativeSet?.call(hiddenSelect, optValue);
        const event = new Event("change", { bubbles: true });
        hiddenSelect.dispatchEvent(event);
      }
    };

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        {/* Hidden native select for react-hook-form */}
        <select
          ref={setRefs}
          id={id}
          name={name}
          value={currentValue}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom trigger button */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          onBlur={onBlur}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cn(!selectedOption && "text-muted-foreground")}>
            {selectedOption?.label ?? placeholder ?? "Wybierz…"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown — portaled to body */}
        {open &&
          createPortal(
            <ul
              ref={dropdownRef}
              role="listbox"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
              }}
              className="z-[9999] max-h-60 overflow-auto rounded-md border border-border bg-popover py-1 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]"
            >
              {options.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                      isSelected
                        ? "bg-primary font-bold text-primary-foreground"
                        : "text-popover-foreground hover:bg-primary/15 hover:text-foreground"
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {opt.label}
                  </li>
                );
              })}
            </ul>,
            document.body
          )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
