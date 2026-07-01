import { useEffect, useId, useRef, useState } from 'react';
import type { SelectHTMLAttributes, Ref } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

export default function Select({
  label,
  error,
  helperText,
  options,
  placeholder,
  id,
  className = '',
  ref,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  required,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = error || helperText ? `${selectId}-description` : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenSelectRef = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const currentValue = String(value ?? defaultValue ?? '');
  const selectedOption = options.find((option) => option.value === currentValue);
  const displayLabel = selectedOption?.label ?? placeholder ?? 'Select';

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function assignRef(node: HTMLSelectElement | null) {
    hiddenSelectRef.current = node;
    if (!ref) return;
    if (typeof ref === 'function') ref(node);
    else ref.current = node;
  }

  function emitChange(nextValue: string) {
    if (disabled) return;
    const nextOption = options.find((option) => option.value === nextValue);
    if (nextOption?.disabled) return;
    if (hiddenSelectRef.current) hiddenSelectRef.current.value = nextValue;
    onChange?.({ target: { value: nextValue, name } } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  return (
    <div className="field themed-select-field" ref={rootRef}>
      {label && (
        <label htmlFor={selectId} className="field-label">
          {label}
        </label>
      )}
      <div className="themed-select-control">
        <button
          type="button"
          id={selectId}
          className={`field-control themed-select-trigger ${error ? 'field-control-error' : ''} ${open ? 'is-open' : ''} ${className}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={descriptionId}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className={selectedOption ? '' : 'is-placeholder'}>{displayLabel}</span>
          <span className="themed-select-caret" aria-hidden="true">v</span>
        </button>
        {open && !disabled && (
          <div className="themed-select-menu" role="listbox" aria-labelledby={selectId}>
            {placeholder && (
              <button
                type="button"
                className={`themed-select-option${currentValue === '' ? ' is-selected' : ''}`}
                role="option"
                aria-selected={currentValue === ''}
                disabled={required}
                onClick={() => emitChange('')}
              >
                <span>{placeholder}</span>
              </button>
            )}
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`themed-select-option${option.value === currentValue ? ' is-selected' : ''}`}
                role="option"
                aria-selected={option.value === currentValue}
                disabled={option.disabled}
                onClick={() => emitChange(option.value)}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
        <select
          ref={assignRef}
          className="themed-select-native"
          tabIndex={-1}
          aria-hidden="true"
          value={currentValue}
          name={name}
          disabled={disabled}
          required={required}
          onChange={onChange}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {(error || helperText) && (
        <p id={descriptionId} className={`field-help ${error ? 'field-error' : ''}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}
