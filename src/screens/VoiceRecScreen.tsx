import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { MoneyText } from '../components/Formatters';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { custInvoices, custOpen, getCust, invRem } from '../core/ledger';
import { fmt, getMU, Money } from '../core/format';
import type { PaymentMethod } from '../types/daftari';

const SNAPSHOT_WAVE_HEIGHTS = [
  11, 18, 12, 22, 10, 6, 8, 11, 14, 10, 19, 27, 17, 23, 14, 25, 16, 11, 20, 10, 7, 11, 8, 13, 8,
];

const WaveBars: React.FC<{ red?: boolean; opacity?: number }> = ({ red, opacity }) => (
  <div className={`wave${red ? ' red' : ''}`} style={opacity !== undefined ? { opacity } : undefined}>
    {Array.from({ length: 24 }, (_, i) => (
      <i
        key={i}
        style={
          {
            '--d': `${i * 0.06}s`,
            '--h': `${8 + ((i * 37) % 24)}px`,
          } as React.CSSProperties
        }
      />
    ))}
  </div>
);

export const VoiceRecScreen: React.FC<{ kind?: 'debt' | 'pay' }> = ({ kind }) => {
  const {
    dd,
    ix,
    curAcc,
    sec,
    isP,
    ui,
    setUi,
    t,
    go,
    openSheet,
    endRec,
    cancelRec,
    retryRec,
    recConfirm,
    toastMsg,
    liveTranscript,
    micLevel,
  } = useApp();

  const r = ui.rec || {
    st: 'rec' as const,
    kind: kind || ('debt' as const),
    edit: false,
    d: { name: '', amt: 0, note: '', due: null, method: 'cash' as const, say: '', custId: null },
    cands: [],
    pre: null,
    t0: Date.now(),
    warn: null,
  };

  const isDebt = r.kind === 'debt';
  const mu = getMU(curAcc);
  const amtInputRef = useRef<HTMLInputElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [editCustId, setEditCustId] = useState<string>(r.d.custId || '');
  const [editAmt, setEditAmt] = useState<string>(r.d.amt ? Money.dec(r.d.amt, mu) : '');
  const [editNote, setEditNote] = useState<string>(r.d.note || '');

  useEffect(() => {
    if (r.st === 'rec') {
      const id = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - r.t0) / 1000));
      }, 400);
      return () => clearInterval(id);
    }
  }, [r.st, r.t0]);

  useEffect(() => {
    const activeCusts = (dd.customers || []).filter((c) => !c.archived);
    setEditCustId(r.d.custId || (activeCusts[0]?.id || ''));
    setEditAmt(r.d.amt ? Money.dec(r.d.amt, mu) : '');
    setEditNote(r.d.note || '');
  }, [r.st, r.d.custId, r.d.amt, r.d.note, dd.customers, mu]);

  const activeCusts = useMemo(
    () => (dd.customers || []).filter((c) => !c.archived),
    [dd.customers]
  );

  const quickCusts = useMemo(() => {
    const list = [...(r.cands || [])];
    const seen = new Set(list.map((c) => c.id));
    if (editCustId && !seen.has(editCustId)) {
      const sel = activeCusts.find((c) => c.id === editCustId);
      if (sel) {
        list.unshift(sel);
        seen.add(sel.id);
      }
    }
    for (const c of activeCusts) {
      if (list.length >= 5) break;
      if (!seen.has(c.id)) {
        list.push(c);
        seen.add(c.id);
      }
    }
    return list;
  }, [r.cands, activeCusts, editCustId]);

  const accentColor = isDebt ? 'var(--red)' : 'var(--green)';

  if (r.st === 'rec') {
    const scStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    const d = r.d || {};
    const hasC = !!(d.custId || d.name);
    const hasA = (d.amt || 0) > 0;
    const hasN = !!d.note;
    const isActiveMic = micLevel.some((v) => v > 5);

    return (
      <>
        <HeaderBar
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: accentColor,
                  animation: 'recpulse 1.2s ease-in-out infinite',
                }}
              />
              {isDebt ? t('recDebt') : t('recPay')}
            </span>
          }
          onBack={cancelRec}
          extra={
            <span
              className="num"
              id="recT"
              style={{ fontWeight: 900, fontSize: 15, color: accentColor, minWidth: 52, textAlign: 'end' }}
            >
              {scStr}
            </span>
          }
        />

        <div className="micwrap">
          <button
            type="button"
            className="mic live"
            onClick={endRec}
            aria-label={t('recStop')}
            style={{
              background: isDebt
                ? 'radial-gradient(circle at 35% 30%, #be264c, #8c1735 75%)'
                : 'radial-gradient(circle at 35% 30%, #0f7b53, #0a573a 75%)',
              boxShadow: isDebt
                ? '0 14px 32px rgba(190, 38, 76, .34), 0 0 0 10px rgba(190, 38, 76, .10)'
                : '0 14px 32px rgba(15, 123, 83, .34), 0 0 0 10px rgba(15, 123, 83, .10)',
            }}
          >
            <Icon name="mic" size={48} />
          </button>

          {isActiveMic ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 42, marginTop: 14 }}>
              {micLevel.map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: Math.max(6, h),
                    borderRadius: 4,
                    background: accentColor,
                    transition: 'height .1s',
                  }}
                />
              ))}
            </div>
          ) : (
            <WaveBars red={isDebt} />
          )}

          <div style={{ fontWeight: 800, fontSize: 14.5, color: accentColor, marginTop: 6 }}>
            {t('recOn')}
          </div>

          {liveTranscript ? (
            <div
              className="transcript"
              id="liveTx"
              aria-live="polite"
              style={{
                background: isDebt ? 'var(--red-bg)' : 'var(--green-bg)',
                borderColor: isDebt ? 'var(--red-line)' : 'var(--green-line)',
                color: accentColor,
                maxWidth: '90%',
                textAlign: 'center',
              }}
            >
              «{liveTranscript.slice(0, 72)}»
            </div>
          ) : (
            <div className="vr-hint-pill">
              <b>{t('example')}</b>
            </div>
          )}
        </div>

        {!isP && (
          <div className="pad" style={{ marginTop: 12 }}>
            <div className={`vr-live-steps${isDebt ? '' : ' two'}`}>
              <div className={`vr-lstep${hasC ? ' done' : ''}`}>
                <span className="vr-lstep-lbl">{t('cust')}</span>
                <span className="vr-lstep-val" style={{ color: hasC ? 'var(--green)' : 'var(--muted)' }}>
                  {hasC ? d.name : '—'}
                </span>
              </div>
              <div className={`vr-lstep${hasA ? (isDebt ? ' done red' : ' done') : ''}`}>
                <span className="vr-lstep-lbl">{t('amount')}</span>
                <span className="vr-lstep-val" style={{ color: hasA ? accentColor : 'var(--muted)' }}>
                  {hasA ? <MoneyText amount={d.amt} /> : '—'}
                </span>
              </div>
              {isDebt && (
                <div className={`vr-lstep${hasN ? ' done' : ''}`}>
                  <span className="vr-lstep-lbl">{t('remind')}</span>
                  <span className="vr-lstep-val" style={{ color: hasN ? 'var(--ink)' : 'var(--muted)' }}>
                    {hasN ? d.note : t('optF')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pad" style={{ marginTop: 10 }}>
          <div className="muted" style={{ textAlign: 'center', fontSize: 12, lineHeight: 1.65 }}>
            {t('voiceHint')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 20px 8px' }}>
          <button type="button" className="btn btn-line" style={{ flex: 1 }} onClick={cancelRec}>
            <Icon name="x" size={16} />
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`btn ${isDebt ? 'btn-red' : 'btn-green'}`}
            style={{ flex: 1.5 }}
            onClick={endRec}
          >
            <Icon name="checkc" size={17} />
            {t('recStop')}
          </button>
        </div>

        <div className="pad" style={{ padding: '4px 20px 22px' }}>
          <button type="button" className="btn btn-soft" style={{ width: '100%', fontSize: 14, padding: '12px 16px' }} onClick={() => openSheet({ type: 'extVoice' })}>
            <Icon name="edit" size={16} /> {t('extBtn')}
          </button>
        </div>
      </>
    );
  }

  // Confirmation / edit state
  const parsedAmt = Money.parse(editAmt, mu);
  const targetCust = editCustId ? getCust(dd, editCustId) : null;
  const amtMissing = parsedAmt <= 0;

  let payImpactEl: React.ReactNode = null;
  if (!isDebt && targetCust && parsedAmt > 0) {
    const open = custInvoices(dd, targetCust.id)
      .filter((i) => invRem(ix, i) > 0 && !i.k)
      .sort((a, b) => a.ts - b.ts);
    let left = parsedAmt;
    let allocated = 0;
    open.forEach((i) => {
      if (left <= 0) return;
      const u = Math.min(invRem(ix, i), left);
      left -= u;
      allocated++;
    });
    const before = custOpen(ix, targetCust.id);
    const after = Math.max(0, before - parsedAmt);
    const will = before - parsedAmt <= 0 ? 'willPaid' : allocated > 0 ? 'willPart' : 'willOpen';
    payImpactEl = (
      <div className="wz-impact">
        <div className="wz-impact-row">
          <span>
            {t('nowOwe')}: <b className="num">{fmt(before, mu)}</b>
          </span>
          <span style={{ color: 'var(--green)', fontWeight: 800 }}>
            {t('afterOp')}: <b className="num">{fmt(after, mu)}</b> {curAcc.cur}
          </span>
        </div>
        <div className="wz-impact-row" style={{ paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: will === 'willPaid' ? 'var(--green)' : 'var(--amber)' }}>
            <Icon name={will === 'willPaid' ? 'checkc' : 'clock'} size={16} />
            {t(will)}
          </span>
          <span className="num" style={{ fontWeight: 900, color: will === 'willPaid' ? 'var(--green)' : 'var(--amber)' }}>
            {fmt(after, mu)} {curAcc.cur}
          </span>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!isP && !editCustId) {
      haptic('error', sec);
      toastMsg(t('chooseFirst'));
      return;
    }
    if (parsedAmt <= 0) {
      haptic('error', sec);
      toastMsg(t('enterAmt'));
      amtInputRef.current?.focus();
      return;
    }
    recConfirm(editCustId, editAmt, editNote);
  };

  return (
    <>
      <div className="vr-hdr">
        <button type="button" className="vr-back" aria-label={t('back')} onClick={cancelRec}>
          <Icon name="back" size={20} />
        </button>
        <h1>{isDebt ? t('recDebt') : t('recPay')}</h1>
        <span style={{ width: 42 }} aria-hidden="true" />
      </div>

      <button
        type="button"
        className={`vr-wave${isDebt ? '' : ' pay'}`}
        aria-label={t('retryRec')}
        title={t('retryRec')}
        onClick={retryRec}
      >
        <div className="vr-wave-bars">
          {SNAPSHOT_WAVE_HEIGHTS.map((h, i) => (
            <i key={i} style={{ height: `calc(${h}px * var(--s))` }} />
          ))}
        </div>
        <span className="vr-wave-cap">
          <Icon name="mic" size={12} /> {t('tapRetry')}
        </span>
      </button>

      <div className="pad" style={{ paddingBottom: 28 }}>
        <div className="vr-card">
          {!isP && (
            <div className="vr-row">
              <label className="vr-lbl" htmlFor="vr-cust">
                <Icon name="user" size={18} />
                <span>{t('cust')}</span>
              </label>
              <div className="vr-ctl">
                <select
                  id="vr-cust"
                  className="vr-input"
                  value={editCustId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const found = activeCusts.find((c) => c.id === id);
                    setEditCustId(id);
                    setUi((prev) =>
                      prev.rec
                        ? { ...prev, rec: { ...prev.rec, d: { ...prev.rec.d, custId: id, name: found?.name || '' } } }
                        : prev
                    );
                  }}
                >
                  {activeCusts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="vr-row">
            <label className="vr-lbl" htmlFor="vr-amt">
              <Icon name="wallet" size={18} />
              <span>
                {t('amount')} ({curAcc.cur})
                <span className="vr-req">*</span>
              </span>
            </label>
            <div className="vr-ctl">
              <input
                ref={amtInputRef}
                id="vr-amt"
                className={`vr-input num${amtMissing || r.warn ? ' vr-err' : ''}`}
                type="number"
                inputMode="decimal"
                placeholder={t('enterAmtPh')}
                value={editAmt}
                onChange={(e) => setEditAmt(e.target.value)}
              />
            </div>
          </div>

          {isDebt ? (
            <div className="vr-row">
              <label className="vr-lbl" htmlFor="vr-note">
                <Icon name="tag" size={18} />
                <span>{t('remind')}</span>
              </label>
              <div className="vr-ctl">
                <input
                  id="vr-note"
                  className="vr-input"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={t('remindPh')}
                />
              </div>
            </div>
          ) : (
            <div className="vr-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <span className="vr-lbl">
                <Icon name="coins" size={18} />
                <span>{t('method')}</span>
              </span>
              <div className="seg">
                {(['cash', 'transfer', 'cardpay'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={(r.d.method || 'cash') === m ? 'on' : ''}
                    onClick={() => {
                      haptic('tap', sec);
                      setUi((prev) =>
                        prev.rec
                          ? { ...prev, rec: { ...prev.rec, d: { ...prev.rec.d, method: m } } }
                          : prev
                      );
                    }}
                  >
                    {t(m)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {(r.warn || amtMissing) && (
          <div className={`vr-warn${r.warn ? ' err' : ''}`}>
            <Icon name="shield" size={16} />
            <span>{r.warn ? t('warn_' + r.warn) : t('verifyBeforeSave')}</span>
          </div>
        )}

        {!isP && (
          <>
            <div className="vr-cand-label">{t('cand')}</div>
            <div className="vr-cands">
              {quickCusts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`vr-cand-btn${c.id === editCustId ? ' on' : ''}`}
                  onClick={() => {
                    haptic('tap', sec);
                    setEditCustId(c.id);
                    setUi((prev) =>
                      prev.rec
                        ? { ...prev, rec: { ...prev.rec, d: { ...prev.rec.d, custId: c.id, name: c.name } } }
                        : prev
                    );
                  }}
                >
                  {c.name}
                </button>
              ))}
              <button
                type="button"
                className="vr-cand-add"
                onClick={() => {
                  setUi((prev) => ({
                    ...prev,
                    nc: { name: r.d.name || '', phone: '', limit: '', photo: null, edit: null, forceDup: false },
                    recPend: true,
                  }));
                  go('newcust', {});
                }}
              >
                + {t('addC')}
              </button>
            </div>
          </>
        )}

        {payImpactEl}

        <div className="vr-actions">
          <button
            type="button"
            className={`vr-confirm${isDebt ? '' : ' pay'}`}
            onClick={handleConfirm}
          >
            <Icon name="checkc" size={18} />
            <span>{isDebt ? t('confirmReg') : t('confirmPay')}</span>
          </button>

          <button
            type="button"
            className="vr-edit"
            onClick={() => {
              amtInputRef.current?.focus();
              amtInputRef.current?.select();
            }}
          >
            <Icon name="edit" size={16} />
            <span>{t('editL')}</span>
          </button>

          <button
            type="button"
            className="vr-close"
            aria-label={t('cancel')}
            onClick={cancelRec}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>
    </>
  );
};
