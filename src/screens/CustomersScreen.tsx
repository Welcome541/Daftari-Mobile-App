import React, { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { Avatar } from '../components/Formatters';
import { LongPressButton } from '../components/LongPressButton';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { custCredit, custOpen, lastAct } from '../core/ledger';
import { fmt, getMU, lastOpTxt, normAr } from '../core/format';
import { filteredCustomers } from '../core/queries';

export const CustomersScreen: React.FC = () => {
  const {
    db,
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
    cselExit,
    cselToggle,
    cselAll,
    cselPin,
    cselShare,
    cselDelete,
  } = useApp();

  const lpTimerRef = useRef<number | null>(null);
  const lpPosRef = useRef({ x: 0, y: 0 });
  const lpFiredRef = useRef(0);
  const lpKeyRef = useRef('');
  const touchSeenRef = useRef(0);
  const [holdingKey, setHoldingKey] = useState<string | null>(null);

  const list = useMemo(() => filteredCustomers(dd, ix, ui.f, ui.cq), [dd, ix, ui.f, ui.cq]);

  if (!db) return null;

  const openNewCustomer = (prefillName = '') => {
    haptic('tap', sec);
    setUi((prev) => ({
      ...prev,
      nc: { name: prefillName, phone: '', limit: '', photo: null, edit: null, forceDup: false },
    }));
    go('newcust', {});
  };

  if (isP) {
    return (
      <>
        <div className="hdr">
          <div className="sp" style={{ textAlign: 'start' }}>
            <h1 className="bighdr">{t('customers')}</h1>
          </div>
        </div>
        <div className="pad">
          <div className="card" style={{ padding: '30px 22px', textAlign: 'center' }}>
            <span
              className="av"
              style={{ width: 70, height: 70, margin: '0 auto', background: 'var(--green-bg)', color: 'var(--green)' }}
            >
              <Icon name="user" size={30} />
            </span>
            <div style={{ fontWeight: 800, marginTop: 12, fontSize: 17 }}>{t('personal')}</div>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.8 }}>
              {t('personalMsg')}
            </div>
            <LongPressButton kind="debt" cls="btn-red" icon="mic" label={t('recDebt')} style={{ marginTop: 16 }} />
          </div>
        </div>
      </>
    );
  }

  if (ui.arch) {
    const q = normAr(ui.archQ || '');
    const archList = (dd.customers || [])
      .filter((c) => c.archived)
      .filter((c) => !q || normAr(c.name).includes(q));
    return (
      <>
        <HeaderBar
          title={t('archListT')}
          onBack={() => setUi((prev) => ({ ...prev, arch: false }))}
        />
        <div className="pad list ops" id="clist2" style={{ marginTop: 12, paddingBottom: 14 }}>
          <div className="inp card" style={{ marginBottom: 10 }}>
            <Icon name="search" size={17} />
            <input
              placeholder={t('searchC')}
              value={ui.archQ}
              onChange={(e) => setUi((prev) => ({ ...prev, archQ: e.target.value }))}
            />
          </div>
          {archList.length ? (
            archList.map((c) => (
              <div key={c.id} className="card litem" onClick={() => go('profile', { id: c.id })}>
                <Avatar name={c.name} size={46} cid={c.id} />
                <div className="sp">
                  <b>{c.name}</b>
                  <div className="muted">
                    {t('lastOp')}: {lastOpTxt(lastAct(ix, c.id), db)}
                  </div>
                </div>
                <button
                  className="btn btn-soft"
                  style={{ width: 'auto', padding: '9px 14px', fontSize: 13 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic('tap', sec);
                    openSheet({ type: 'confirmRestore', cid: c.id });
                  }}
                >
                  <Icon name="undo" size={15} />
                  {t('restore')}
                </button>
              </div>
            ))
          ) : (
            <div className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
              {t('noArch')}
            </div>
          )}
        </div>
      </>
    );
  }

  const sortBadgeCount = ui.f.sort && ui.f.sort !== 'recent' ? 1 : 0;
  const activeCs = (dd.customers || []).filter((c) => !c.archived);
  const owingCount = activeCs.filter((c) => custOpen(ix, c.id) > 0).length;
  const settledCount = activeCs.length - owingCount;
  const totalDueAmt = activeCs.reduce((sum, c) => sum + Math.max(0, custOpen(ix, c.id)), 0);
  const vis = list.slice(0, ui.cmax || 60);
  const selMode = ui.csel.on;
  const mu = getMU(curAcc);

  const startLongPressC = (cid: string) => {
    if (ui.csel.on) return;
    setHoldingKey(null);
    haptic('select', sec);
    lpKeyRef.current = cid;
    lpFiredRef.current = Date.now();
    setUi((prev) => ({ ...prev, csel: { on: true, ids: [cid] } }));
  };

  const singleCust = selMode && ui.csel.ids.length === 1 ? dd.customers.find((x) => x.id === ui.csel.ids[0]) || null : null;
  const selOpenSum = selMode ? ui.csel.ids.reduce((sum, cid) => sum + custOpen(ix, cid), 0) : 0;
  const allVisSelected = selMode && list.length > 0 && list.every((c) => ui.csel.ids.includes(c.id));

  const noResCFn = t('noResC');
  const addXFn = t('addX');

  const setStatusFilter = (status: 'all' | 'owed' | 'none') => {
    haptic('tap', sec);
    setUi((prev) => ({ ...prev, f: { ...prev.f, status }, cmax: 60 }));
  };

  return (
    <>
      <div className="hdr">
        <div className="sp" style={{ textAlign: 'start' }}>
          <h1 className="bighdr">{t('customers')}</h1>
        </div>
        <button
          type="button"
          className="cust-add-btn"
          onClick={() => openNewCustomer('')}
        >
          <Icon name="userplus" size={16} />
          <span>{t('addC')}</span>
        </button>
      </div>

      {activeCs.length > 0 && (
        <div className="pad cust-kpis">
          <button
            type="button"
            className={`cust-kpi red${ui.f.status === 'owed' ? ' on' : ''}`}
            onClick={() => setStatusFilter(ui.f.status === 'owed' ? 'all' : 'owed')}
          >
            <div className="cust-kpi-lbl">{t('totalDue')}</div>
            <div className="cust-kpi-val">
              <span className="num">{fmt(totalDueAmt, mu)}</span>
              <span className="cur">{curAcc.cur}</span>
            </div>
            <div className="cust-kpi-sub">
              {owingCount > 0 ? (
                <>
                  <span className="num">{owingCount}</span> {t('nOwe')}
                </>
              ) : (
                t('settled')
              )}
            </div>
          </button>

          <button
            type="button"
            className={`cust-kpi navy${ui.f.status === 'none' ? ' on' : ''}`}
            onClick={() => setStatusFilter(ui.f.status === 'none' ? 'all' : 'none')}
          >
            <div className="cust-kpi-lbl">{t('customers')}</div>
            <div className="cust-kpi-val">
              <span className="num">{activeCs.length}</span>
            </div>
            <div className="cust-kpi-sub">
              <span className="num">{settledCount}</span> {t('noDebtF')}
            </div>
          </button>
        </div>
      )}

      <div className="pad search" style={{ marginTop: 12 }}>
        <div className="inp card">
          <Icon name="search" size={17} />
          <input
            placeholder={t('searchC')}
            value={ui.cq}
            onChange={(e) => setUi((prev) => ({ ...prev, cq: e.target.value, cmax: 60 }))}
          />
          {ui.cq && (
            <button
              type="button"
              className="cust-clear"
              aria-label={t('clearF')}
              onClick={() => {
                haptic('tap', sec);
                setUi((prev) => ({ ...prev, cq: '', cmax: 60 }));
              }}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <button
          className="hbtn"
          id="cfbtn"
          style={{ height: 46, width: 46, padding: 0, justifyContent: 'center', position: 'relative' }}
          aria-label={t('custMenu')}
          onClick={() => openSheet({ type: 'custListMenu' })}
        >
          <Icon name="dots" size={19} />
          {sortBadgeCount > 0 && (
            <span className="notif-badge">
              <span className="num">{sortBadgeCount}</span>
            </span>
          )}
        </button>
      </div>

      {activeCs.length > 0 && (
        <div className="pad">
          <div className="seg cust-tabs" role="tablist" aria-label={t('filter')}>
            <button
              type="button"
              className={ui.f.status === 'all' ? 'on' : ''}
              onClick={() => setStatusFilter('all')}
            >
              <span>{t('all')}</span>
              <span className="num">{activeCs.length}</span>
            </button>
            <button
              type="button"
              className={ui.f.status === 'owed' ? 'on r' : ''}
              onClick={() => setStatusFilter('owed')}
            >
              <span>{t('owedF')}</span>
              <span className="num">{owingCount}</span>
            </button>
            <button
              type="button"
              className={ui.f.status === 'none' ? 'on' : ''}
              onClick={() => setStatusFilter('none')}
            >
              <span>{t('noDebtF')}</span>
              <span className="num">{settledCount}</span>
            </button>
          </div>
        </div>
      )}

      {selMode && (
        <div className="pad sel-top-wrap">
          <div className="sel-top">
            <div className="sel-top-head">
              <button className="sel-close" onClick={cselExit} aria-label={t('cancel')}>
                <Icon name="x" size={16} />
              </button>
              <div className="sel-info">
                <div className="sel-count">
                  <span>{t('selN')}</span>
                  <span className="num">{ui.csel.ids.length}</span>
                </div>
                <div className="sel-sub">
                  {ui.csel.ids.length === 0 ? (
                    t('selEmpty')
                  ) : singleCust ? (
                    singleCust.name
                  ) : selOpenSum > 0 ? (
                    <span style={{ color: 'var(--red)' }}>
                      {t('totalDue')}: <span className="num">{fmt(selOpenSum, mu)}</span> {curAcc.cur}
                    </span>
                  ) : (
                    t('accounts')
                  )}
                </div>
              </div>
              <button
                className={`sel-all-btn${allVisSelected ? ' on' : ''}`}
                onClick={() => cselAll(list.map((c) => c.id))}
              >
                <Icon name="checkAll" size={15} />
                <span>{t('selAllS')}</span>
              </button>
            </div>

            <div className="sel-top-acts">
              <button
                className={`sel-act amber${ui.csel.ids.length === 0 ? ' disabled' : ''}`}
                onClick={cselPin}
              >
                <Icon name={singleCust?.pinned ? 'pinf' : 'pin'} size={18} />
                <span>{singleCust?.pinned ? t('unpinU') : t('pinAct')}</span>
              </button>
              {singleCust && (
                <>
                  <button
                    className="sel-act navy"
                    onClick={() => {
                      const c = singleCust;
                      cselExit();
                      setUi((prev) => ({
                        ...prev,
                        nc: {
                          name: c.name,
                          phone: c.phone || '',
                          limit: c.limit || '',
                          photo: c.photo || null,
                          edit: c.id,
                          forceDup: false,
                        },
                      }));
                      go('newcust', {});
                    }}
                  >
                    <Icon name="edit" size={18} />
                    <span>{t('editL')}</span>
                  </button>
                  <button
                    className="sel-act"
                    onClick={() => {
                      const id = singleCust.id;
                      cselExit();
                      openSheet({ type: 'quickActions', cid: id });
                    }}
                  >
                    <Icon name="zap" size={18} />
                    <span>{t('quickAct')}</span>
                  </button>
                </>
              )}
              <button
                className={`sel-act${ui.csel.ids.length === 0 ? ' disabled' : ''}`}
                onClick={cselShare}
              >
                <Icon name="share" size={18} />
                <span>{t('share')}</span>
              </button>
              <button
                className={`sel-act red${ui.csel.ids.length === 0 ? ' disabled' : ''}`}
                onClick={cselDelete}
              >
                <Icon name="trash" size={18} />
                <span>{t('del')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pad list ops" id="clist2" style={{ marginTop: 10, paddingBottom: 14 }}>
        {!list.length ? (
          !activeCs.length ? (
            <div className="card" style={{ padding: '30px 22px', textAlign: 'center' }}>
              <span
                className="av"
                style={{ width: 70, height: 70, margin: '0 auto', background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--navy)' }}
              >
                <Icon name="users" size={30} />
              </span>
              <div style={{ fontWeight: 800, marginTop: 12, fontSize: 17 }}>{t('noCustomers')}</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.8 }}>
                {t('addFirstD')}
              </div>
              <button
                className="btn btn-navy"
                style={{ marginTop: 14 }}
                onClick={() => openNewCustomer('')}
              >
                <Icon name="userplus" size={16} />
                <span>{t('addC')}</span>
              </button>
              <button
                className="btn btn-line"
                style={{ marginTop: 10 }}
                onClick={() => openSheet({ type: 'demoData' })}
              >
                <Icon name="zap" size={16} />
                {t('demoLoad')}
              </button>
              <div className="muted" style={{ marginTop: 18 }}>
                {t('paperQ')}
              </div>
              <button
                className="btn btn-line"
                style={{ marginTop: 8 }}
                onClick={() => openSheet({ type: 'paperLedger' })}
              >
                <Icon name="cam" size={16} />
                {t('paperGo')}
              </button>
            </div>
          ) : ui.cq.trim() ? (
            <div className="card" style={{ padding: '26px 20px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800 }}>
                {typeof noResCFn === 'function' ? noResCFn(ui.cq.trim()) : ui.cq.trim()}
              </div>
              <button
                className="btn btn-navy"
                style={{ marginTop: 14 }}
                onClick={() => openNewCustomer(ui.cq.trim())}
              >
                {typeof addXFn === 'function' ? addXFn(ui.cq.trim()) : ui.cq.trim()}
              </button>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
              <div className="muted" style={{ fontWeight: 700 }}>{t('noRes')}</div>
              {ui.f.status !== 'all' && (
                <button
                  type="button"
                  className="btn btn-line"
                  style={{ width: 'auto', margin: '12px auto 0', padding: '9px 18px', fontSize: 13.5 }}
                  onClick={() => setStatusFilter('all')}
                >
                  {t('all')}
                </button>
              )}
            </div>
          )
        ) : (
          <>
            {vis.map((c) => {
              const open = custOpen(ix, c.id);
              const credit = custCredit(ix, c.id);
              const isSel = selMode && ui.csel.ids.includes(c.id);
              const phone = c.phone ? String(c.phone).trim() : '';
              const lastTs = lastAct(ix, c.id);
              const actTxt = lastTs ? lastOpTxt(lastTs, db) : t('noOps');
              const overLim = !!(c.limit && open > c.limit);

              return (
                <div
                  key={c.id}
                  className={`card litem orow${isSel ? ' sel' : ''}${holdingKey === c.id ? ' lp-hold' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (selMode) {
                      if (Date.now() - lpFiredRef.current < 900 && c.id === lpKeyRef.current) return;
                      cselToggle(c.id);
                    } else {
                      if (Date.now() - lpFiredRef.current < 900) return;
                      go('profile', { id: c.id });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (selMode) cselToggle(c.id);
                      else go('profile', { id: c.id });
                    }
                  }}
                  onPointerDown={(e) => {
                    if (selMode || Date.now() - touchSeenRef.current < 800 || e.pointerType === 'touch') return;
                    lpPosRef.current = { x: e.clientX, y: e.clientY };
                    setHoldingKey(c.id);
                    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                    lpTimerRef.current = window.setTimeout(() => {
                      lpTimerRef.current = null;
                      startLongPressC(c.id);
                    }, 380);
                  }}
                  onPointerUp={() => {
                    setHoldingKey(null);
                    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                    lpTimerRef.current = null;
                  }}
                  onPointerLeave={() => {
                    setHoldingKey(null);
                    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                    lpTimerRef.current = null;
                  }}
                  onTouchStart={(e) => {
                    touchSeenRef.current = Date.now();
                    if (selMode) return;
                    const pt = e.touches[0];
                    if (!pt) return;
                    lpPosRef.current = { x: pt.clientX, y: pt.clientY };
                    setHoldingKey(c.id);
                    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                    lpTimerRef.current = window.setTimeout(() => {
                      lpTimerRef.current = null;
                      startLongPressC(c.id);
                    }, 380);
                  }}
                  onTouchMove={(e) => {
                    if (!lpTimerRef.current) return;
                    const pt = e.touches[0];
                    if (pt && Math.abs(pt.clientX - lpPosRef.current.x) + Math.abs(pt.clientY - lpPosRef.current.y) > 10) {
                      setHoldingKey(null);
                      clearTimeout(lpTimerRef.current);
                      lpTimerRef.current = null;
                    }
                  }}
                  onTouchEnd={() => {
                    setHoldingKey(null);
                    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                    lpTimerRef.current = null;
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {selMode && (
                    <span className={`orow-sel${isSel ? ' on' : ''}`}>
                      {isSel ? <Icon name="checkb" size={15} /> : null}
                    </span>
                  )}

                  <Avatar name={c.name} size="var(--row-av)" cid={c.id} />

                  <div className="orow-mid">
                    <div className="orow-name">
                      {c.pinned && <Icon name="pinf" size={13} className="cust-pin-ic" />}
                      <span>{c.name}</span>
                    </div>
                    <div className="orow-meta">
                      <span className="orow-time">{actTxt}</span>
                      {phone ? (
                        <>
                          <span className="sep">·</span>
                          <a
                            href={`tel:${phone}`}
                            className="cust-phone-link num"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon name="phone" size={12} />
                            <span>{phone}</span>
                          </a>
                        </>
                      ) : null}
                      {overLim ? (
                        <>
                          <span className="sep">·</span>
                          <span className="cust-over-txt">{t('overLimitS')}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="orow-side">
                    {open > 0 ? (
                      <>
                        <span className="orow-amt red">
                          <span className="num">{fmt(open, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                        <span className="orow-kind red">{t('owedF')}</span>
                      </>
                    ) : credit > 0 ? (
                      <>
                        <span className="orow-amt green">
                          <span className="num">{fmt(-credit, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                        <span className="orow-kind green">{t('settled')}</span>
                      </>
                    ) : (
                      <>
                        <span className="orow-amt gray">
                          <span className="num">{fmt(0, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                        <span className="orow-kind muted">{t('settled')}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {list.length > vis.length && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-line"
                  style={{ width: 'auto', padding: '10px 18px', fontSize: 13.5 }}
                  onClick={() => {
                    haptic('tap', sec);
                    setUi((prev) => ({ ...prev, cmax: (prev.cmax || 60) + 60 }));
                  }}
                >
                  {t('showMore')} (<span className="num">{list.length - vis.length}</span>)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
