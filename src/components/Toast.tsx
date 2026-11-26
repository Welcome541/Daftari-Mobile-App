import React from 'react';
import { Icon } from './Icon';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, hideToast, doUndoToast, shareOneById, t } = useApp();

  return (
    <div id="toast" role="status" aria-live="polite" className={toast.show ? 'show' : ''}>
      <span style={{ flex: 1, lineHeight: 1.5 }}>
        {toast.title && <b>{toast.title}</b>}
        {toast.title && toast.amountStr ? ' · ' : ''}
        {toast.amountStr}
        {toast.subtitle && (
          <>
            <br />
            <span style={{ fontSize: 11.5, opacity: 0.8 }}>{toast.subtitle}</span>
          </>
        )}
        {!toast.title && toast.message}
      </span>
      {toast.shareId && (
        <button
          className="tb"
          style={{ borderColor: '#9fd0ff', color: '#9fd0ff', padding: '7px 10px' }}
          aria-label={t('shareLbl')}
          onClick={() => {
            const id = toast.shareId!;
            hideToast();
            shareOneById('d:' + id);
          }}
        >
          <Icon name="share" size={14} />
        </button>
      )}
      {toast.undoFn && (
        <button className="tb" onClick={doUndoToast}>
          <Icon name="undo" size={14} />
          {t('undo')}
        </button>
      )}
    </div>
  );
};
