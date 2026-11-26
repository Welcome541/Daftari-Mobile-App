import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export const BottomSheet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sheet, closeSheet } = useApp();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheet) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      try {
        sheetRef.current?.focus();
      } catch {
        // ignore
      }
    }, 40);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSheet();
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>('button,select,input,textarea,[tabindex]')
        ).filter((x) => !(x as HTMLButtonElement).disabled);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      try {
        prevFocus?.focus?.();
      } catch {
        // ignore
      }
    };
  }, [sheet, closeSheet]);

  return (
    <div id="sheetWrap" role="dialog" aria-modal="true" className={sheet ? 'open' : ''}>
      <div className="bk" onClick={closeSheet} />
      <div id="sheet" ref={sheetRef} tabIndex={-1}>
        <div className="grab" />
        {sheet ? children : null}
      </div>
    </div>
  );
};
