import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { RunningHubCatalogGroup, RunningHubCatalogItem } from '../../services/runninghubCatalog';

interface RunningHubGroupedSelectProps {
  value: string;
  groups: RunningHubCatalogGroup[];
  loading: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}

function optionLabel(item: RunningHubCatalogItem) {
  return `${item.title} · ${item.providerName} · ${item.fields.length} 字段`;
}

export default function RunningHubGroupedSelect({
  value,
  groups,
  loading,
  placeholder,
  onChange,
}: RunningHubGroupedSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const options = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ group, item }))),
    [groups],
  );
  const selected = options.find(({ item }) => item.catalogId === value)?.item;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex(({ item }) => item.catalogId === value && item.enabled !== false);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.findIndex(({ item }) => item.enabled !== false));
  }, [open, options, value]);

  const selectOption = (item: RunningHubCatalogItem) => {
    if (item.enabled === false) return;
    onChange(item.catalogId);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let offset = 0; offset < options.length; offset += 1) {
      next = (next + direction + options.length) % options.length;
      if (options[next]?.item.enabled !== false) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (options[activeIndex]) {
        selectOption(options[activeIndex].item);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const indices = options.map(({ item }, index) => (item.enabled === false ? -1 : index)).filter((index) => index >= 0);
      if (indices.length > 0) setActiveIndex(event.key === 'Home' ? indices[0] : indices[indices.length - 1]);
    }
  };

  return (
    <div ref={rootRef} className="nodrag nowheel relative" onMouseDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={handleKeyDown}
        className="flex h-8 w-full items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2 text-left text-xs text-white outline-none transition hover:bg-white/10 focus:border-white/30"
      >
        <span className={selected ? 'truncate text-white' : 'truncate text-white/75'}>
          {selected ? optionLabel(selected) : loading ? '正在读取后台条目...' : placeholder}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-white/55 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="后台条目"
          className="absolute left-0 top-full z-[80] mt-1 max-h-64 w-full overflow-y-auto rounded border border-white/15 bg-[#17191e] py-1 shadow-2xl shadow-black/40"
        >
          {groups.length === 0 ? (
            <div className="px-2 py-2 text-[10px] text-white/45">{loading ? '正在读取后台条目...' : '暂无可用后台条目'}</div>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="border-y border-white/10 bg-[#242830] px-2 py-1.5 text-[10px] font-semibold tracking-wide text-cyan-100/90">
                  {group.label}
                  <span className="ml-1 text-[9px] font-normal text-white/45">{group.items.length}</span>
                </div>
                {group.items.map((item) => {
                  const optionIndex = options.findIndex(({ item: candidate }) => candidate.catalogId === item.catalogId);
                  const isActive = optionIndex === activeIndex;
                  const isSelected = item.catalogId === value;
                  const isDisabled = item.enabled === false;
                  return (
                    <button
                      key={item.catalogId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onMouseEnter={() => setActiveIndex(optionIndex)}
                      onClick={() => selectOption(item)}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] transition ${
                        isActive ? 'bg-cyan-400/15 text-cyan-50' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      } ${isSelected ? 'font-medium' : ''} ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{optionLabel(item)}</span>
                      {isSelected ? <Check size={12} className="shrink-0 text-cyan-300" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
