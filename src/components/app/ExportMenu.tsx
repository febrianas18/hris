'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type ExportMenuVariant = 'primary' | 'secondary' | 'compact';

interface ExportMenuProps {
  label: string;
  onExportCSV: () => void;
  onExportExcel: () => void;
  variant?: ExportMenuVariant;
  className?: string;
}

const TRIGGER_BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const TRIGGER_VARIANTS: Record<ExportMenuVariant, string> = {
  primary:
    'h-9 bg-primary px-3.5 text-primary-foreground shadow-xs hover:bg-primary/90',
  secondary:
    'h-9 border border-border/80 bg-background px-3.5 text-foreground shadow-2xs hover:bg-muted',
  compact:
    'h-8 border border-border/80 bg-background px-2.5 text-[11px] text-foreground shadow-2xs hover:bg-muted',
};

const MENU_WIDTH = 208;
const MENU_HEIGHT = 148;

/**
 * Tombol unduh dengan pilihan format CSV dan Excel.
 * Menu dirender lewat portal agar tidak terpotong oleh header kartu yang
 * memakai overflow-hidden, lalu diposisikan mengikuti tombol pemicunya.
 */
export default function ExportMenu({
  label,
  onExportCSV,
  onExportExcel,
  variant = 'secondary',
  className,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= MENU_HEIGHT + 12
        ? rect.bottom + 8
        : Math.max(12, rect.top - MENU_HEIGHT - 8);
    const left = Math.min(
      window.innerWidth - MENU_WIDTH - 12,
      Math.max(12, rect.right - MENU_WIDTH)
    );

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onViewportChange = () => updatePosition();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    const frame = window.requestAnimationFrame(() => itemRefs.current[0]?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, updatePosition]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    if (items.length === 0) return;

    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const select = (action: () => void) => {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
        className={cn(TRIGGER_BASE, TRIGGER_VARIANTS[variant], className)}
      >
        <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
        <span>{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          strokeWidth={2}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={`Format unduhan ${label}`}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: MENU_WIDTH,
              }}
              onKeyDown={handleMenuKeyDown}
              className="z-[80] overflow-hidden rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
            >
              <button
                ref={(node) => {
                  itemRefs.current[0] = node;
                }}
                type="button"
                role="menuitem"
                onClick={() => select(onExportCSV)}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <FileText
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground">CSV (.csv)</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Teks terstruktur &amp; universal
                  </span>
                </span>
              </button>

              <button
                ref={(node) => {
                  itemRefs.current[1] = node;
                }}
                type="button"
                role="menuitem"
                onClick={() => select(onExportExcel)}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <FileSpreadsheet
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  strokeWidth={1.75}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground">
                    Excel (.xlsx)
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    Spreadsheet siap diolah
                  </span>
                </span>
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
