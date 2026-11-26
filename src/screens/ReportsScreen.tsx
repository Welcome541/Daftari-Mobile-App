import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar, NotifButton } from '../components/HeaderBar';
import { DateStr, TimeStr } from '../components/Formatters';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { getCust } from '../core/ledger';
import { D, fmt, getMU } from '../core/format';
import { repData, repRows } from '../core/queries';
import { libLoad } from '../core/libLoader';

type OpsKindFilter = 'all' | 'debt' | 'pay';

export const ReportsScreen: React.FC<{ isSub?: boolean }> = ({ isSub }) => {
  const { db, dd, curAcc, sec, ui, setUi, t, back, go, openSheet, toastMsg, darkOn } = useApp();
  const rp = ui.rp;
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstRef = useRef<any>(null);
  const [chartReady, setChartReady] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [kindFilter, setKindFilter] = useState<OpsKindFilter>('all');
  const [showAllOps, setShowAllOps] = useState(false);

  const r = useMemo(() => repData(dd, rp), [dd, rp]);

  useEffect(() => {
    setShowAllOps(false);
  }, [rp.mode, rp.day, rp.month, rp.from, rp.to, rp.cust, kindFilter]);

  useEffect(() => {
    if (!showChart) return;
    let mounted = true;
    libLoad('lib/chart.umd.js')
      .then(() => {
        if (mounted && (window as any).Chart) setChartReady(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [showChart]);

  useEffect(() => {
    const Chart = (window as any).Chart;
    const canvas = chartRef.current;
    if (!showChart || !chartReady || !Chart || !canvas || !db) {
      if (chartInstRef.current) {
        try {
          chartInstRef.current.destroy();
        } catch {
          // ignore
        }
        chartInstRef.current = null;
      }
      return;
    }

    if (chartInstRef.current) {
      try {
        chartInstRef.current.destroy();
      } catch {
        // ignore
      }
      chartInstRef.current = null;
    }

    const n = Math.min(31, Math.max(1, Math.round((r.b - r.a) / D)));
    const bw = (r.b - r.a) / n;
    const bk = Array.from({ length: n }, () => ({ d: 0, p: 0 }));
    r.invs.forEach((x) => {
      const idx = Math.max(0, Math.min(n - 1, Math.floor((x.ts - r.a) / bw)));
      bk[idx].d += x.amount;
    });
    r.pays.forEach((x) => {
      const idx = Math.max(0, Math.min(n - 1, Math.floor((x.ts - r.a) / bw)));
      bk[idx].p += x.amount;
    });

    const st = Math.ceil(n / 8);
    const labels = bk.map((_, k) =>
      k % st
        ? ''
        : new Date(r.a + k * bw).toLocaleDateString(db.lang === 'ar' ? 'ar' : 'en-GB', {
            day: 'numeric',
            month: 'numeric',
          })
    );

    const tickColor = darkOn ? '#9aa5b1' : '#5f6873';
    const debtColor = darkOn ? '#d06389' : '#c95a7d';
    const payColor = darkOn ? '#2ea77c' : '#4fa882';

    chartInstRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: t('debtsF'),
            data: bk.map((x) => x.d),
            backgroundColor: debtColor,
            borderRadius: 4,
            maxBarThickness: 14,
          },
          {
            label: t('paysF'),
            data: bk.map((x) => x.p),
            backgroundColor: payColor,
            borderRadius: 4,
            maxBarThickness: 14,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { boxWidth: 10, font: { size: 11 }, color: tickColor },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(128,128,128,.14)' },
            ticks: { color: tickColor, font: { size: 10 } },
          },
        },
      },
    });

    return () => {
      if (chartInstRef.current) {
        try {
          chartInstRef.current.destroy();
        } catch {
          // ignore
        }
        chartInstRef.current = null;
      }
    };
  }, [showChart, chartReady, r, db, t, darkOn]);

  const allItems = useMemo(() => {
    return [
      ...r.invs.map((i) => ({
        id: i.id,
        cust: i.cust,
        ts: i.ts,
        nm: getCust(dd, i.cust)?.name || t('deposit'),
        amt: i.amount,
        k: 'debt' as const,
        note: i.note || '',
      })),
      ...r.pays.map((pp) => ({
        id: pp.id,
        cust: pp.cust,
        ts: pp.ts,
        nm: getCust(dd, pp.cust)?.name || t('deposit'),
        amt: pp.amount,
        k: 'pay' as const,
        note: pp.method ? String(t(pp.method)) : '',
      })),
    ].sort((x, y) => y.ts - x.ts);
  }, [r, dd, t]);

  const filteredItems = useMemo(() => {
    if (kindFilter === 'all') return allItems;
    return allItems.filter((x) => x.k === kindFilter);
  }, [allItems, kindFilter]);

  if (!db) return null;
  const mu = getMU(curAcc);
  const cc = rp.cust ? getCust(dd, rp.cust) : null;
  const totalOps = r.invs.length + r.pays.length;

  const visibleItems = showAllOps ? filteredItems : filteredItems.slice(0, 25);

  const daysCount = Math.min(31, Math.max(1, Math.round((r.b - r.a) / D)));
  const bw = (r.b - r.a) / daysCount;
  const buckets = Array.from({ length: daysCount }, () => ({ d: 0, p: 0 }));
  r.invs.forEach((i) => {
    const k = Math.max(0, Math.min(daysCount - 1, Math.floor((i.ts - r.a) / bw)));
    buckets[k].d += i.amount;
  });
  r.pays.forEach((p) => {
    const k = Math.max(0, Math.min(daysCount - 1, Math.floor((p.ts - r.a) / bw)));
    buckets[k].p += p.amount;
  });
  const mx = Math.max(1, ...buckets.map((b) => Math.max(b.d, b.p)));

  const modeLabel =
    rp.mode === 'day'
      ? t('repDay')
      : rp.mode === 'week'
      ? t('repWeek')
      : rp.mode === 'month'
      ? t('repMonth')
      : t('repRange');

  const handleExportXlsx = async () => {
    try {
      await libLoad('lib/xlsx.full.min.js');
    } catch {
      toastMsg('Excel');
      return;
    }
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      toastMsg('Excel');
      return;
    }
    try {
      const ws = XLSX.utils.aoa_to_sheet(repRows(db, dd, curAcc, rp));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'report');
      XLSX.writeFile(wb, 'dafter-report.xlsx');
      toastMsg(t('done'));
    } catch {
      toastMsg('Excel');
    }
  };

  return (
    <>
      {isSub ? (
        <HeaderBar title={t('repB')} onBack={back} />
      ) : (
        <div className="hdr">
          <div className="sp" style={{ textAlign: 'start' }}>
            <h1 className="bighdr">{t('reports')}</h1>
          </div>
          <NotifButton />
        </div>
      )}

      <div className="pad rep-wrap">
        <div className="card rep-filter">
          <div className="seg">
            {(
              [
                ['day', t('repDay')],
                ['week', t('repWeek')],
                ['month', t('repMonth')],
                ['range', t('repRange')],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={rp.mode === m ? 'on' : ''}
                onClick={() => {
                  haptic('tap', sec);
                  setUi((prev) => ({ ...prev, rp: { ...prev.rp, mode: m } }));
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {rp.mode === 'range' ? (
            <div className="rep-filter-row range">
              <label className="rep-field">
                <span className="rep-flbl">{t('repFrom')}</span>
                <input
                  className="num"
                  type="date"
                  value={rp.from}
                  onChange={(e) => setUi((prev) => ({ ...prev, rp: { ...prev.rp, from: e.target.value } }))}
                />
              </label>
              <label className="rep-field">
                <span className="rep-flbl">{t('repTo')}</span>
                <input
                  className="num"
                  type="date"
                  value={rp.to}
                  onChange={(e) => setUi((prev) => ({ ...prev, rp: { ...prev.rp, to: e.target.value } }))}
                />
              </label>
              <button
                type="button"
                className={`rep-cust-btn full${cc ? ' active' : ''}`}
                onClick={() => openSheet({ type: 'repCustPicker' })}
              >
                <Icon name="user" size={14} />
                <span>{cc ? cc.name : t('repCustAll')}</span>
                <Icon name="chevD" size={14} />
              </button>
            </div>
          ) : (
            <div className="rep-filter-row">
              <label className="rep-field">
                <Icon name="cal" size={14} />
                <input
                  className="num"
                  type={rp.mode === 'month' ? 'month' : 'date'}
                  aria-label={
                    rp.mode === 'month'
                      ? t('repPickMonth')
                      : rp.mode === 'day'
                      ? t('repPickDay')
                      : t('repWeekStart')
                  }
                  value={rp.mode === 'month' ? rp.month : rp.day}
                  onChange={(e) =>
                    setUi((prev) => ({
                      ...prev,
                      rp:
                        rp.mode === 'month'
                          ? { ...prev.rp, month: e.target.value }
                          : { ...prev.rp, day: e.target.value },
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className={`rep-cust-btn${cc ? ' active' : ''}`}
                onClick={() => openSheet({ type: 'repCustPicker' })}
              >
                <Icon name="user" size={14} />
                <span>{cc ? cc.name : t('repCustAll')}</span>
                <Icon name="chevD" size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="rep-kpis">
          <div className="rep-kpi red">
            <span className="rep-kpi-lbl">{t('repDebtSum')}</span>
            <span className="rep-kpi-val">
              <span className="num">{fmt(r.debt, mu)}</span>
              <span className="cur">{curAcc.cur}</span>
            </span>
          </div>
          <div className="rep-kpi green">
            <span className="rep-kpi-lbl">{t('repPaySum')}</span>
            <span className="rep-kpi-val">
              <span className="num">{fmt(r.pay, mu)}</span>
              <span className="cur">{curAcc.cur}</span>
            </span>
          </div>
        </div>

        <div className="rep-toolbar">
          <span className="rep-ops-meta">
            {t('repOps')}: <strong className="num">{totalOps}</strong>
          </span>
          <div className="rep-acts">
            <button
              type="button"
              className={`rep-act-btn${showChart ? ' on' : ''}`}
              onClick={() => {
                haptic('tap', sec);
                setShowChart((v) => !v);
              }}
              aria-expanded={showChart}
            >
              <Icon name="pie" size={15} />
              <span>{t('repCharts')}</span>
            </button>
            <button type="button" className="rep-act-btn excel" onClick={handleExportXlsx}>
              <Icon name="excel" size={15} />
              <span>{t('repXlsx')}</span>
            </button>
          </div>
        </div>

        {showChart && (
          <div className="card rep-chart-card">
            <div className="rep-chart-hdr">
              <div className="rep-chart-title">
                <Icon name="pie" size={15} />
                <span>{modeLabel}</span>
              </div>
              <span className="rep-chart-range num">
                <DateStr ts={r.a} /> – <DateStr ts={r.b - 1} />
              </span>
            </div>
            {chartReady ? (
              <div style={{ position: 'relative', height: 132, marginTop: 10 }}>
                <canvas ref={chartRef} id="chW" />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 96, marginTop: 12 }}>
                {buckets.map((b, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
                    <div
                      style={{
                        flex: 1,
                        background: 'var(--red)',
                        opacity: 0.85,
                        borderRadius: '4px 4px 0 0',
                        height: `${Math.max(3, (b.d / mx) * 90)}px`,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: 'var(--green)',
                        opacity: 0.85,
                        borderRadius: '4px 4px 0 0',
                        height: `${Math.max(3, (b.p / mx) * 90)}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rep-list-hdr">
          <div className="rep-list-title">
            <b>{t('txAll')}</b>
            <span>
              <DateStr ts={r.a} /> – <DateStr ts={r.b - 1} />
            </span>
          </div>
          <div className="rep-kind-seg" role="tablist" aria-label={t('typeG')}>
            {(
              [
                ['all', t('all')],
                ['debt', t('debtsF')],
                ['pay', t('paysF')],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={kindFilter === k ? 'on' : ''}
                onClick={() => {
                  haptic('tap', sec);
                  setKindFilter(k);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length ? (
          <div className="rep-list">
            {visibleItems.map((x) => {
              const cls = x.k === 'debt' ? 'red' : 'green';
              const typeLbl = x.k === 'debt' ? t('newDebt') : t('pay');
              return (
                <div
                  key={`${x.k}-${x.id}`}
                  className="card rep-item"
                  onClick={() => {
                    if (x.k === 'debt') {
                      go('invoice', { id: x.id });
                    } else if (x.cust) {
                      go('profile', { id: x.cust, focus: 'p:' + x.id });
                    }
                  }}
                >
                  <div className="rep-item-mid">
                    <div className="rep-item-name">{x.nm}</div>
                    <div className="rep-item-meta">
                      <span className="rep-item-time">
                        <DateStr ts={x.ts} /> · <TimeStr ts={x.ts} />
                      </span>
                      {x.note ? (
                        <>
                          <span className="rep-item-sep">·</span>
                          <span className="rep-item-note">{x.note}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="rep-item-side">
                    <span className={`rep-item-amt ${cls}`}>
                      <span className="num">{fmt(x.amt, mu)}</span>
                      <span className="cur">{curAcc.cur}</span>
                    </span>
                    <span className={`rep-item-kind ${cls}`}>{typeLbl}</span>
                  </div>
                </div>
              );
            })}
            {filteredItems.length > 25 && !showAllOps && (
              <button
                type="button"
                className="card rep-more"
                onClick={() => setShowAllOps(true)}
              >
                {t('showMore')} (<span className="num">{filteredItems.length - 25}</span>)
              </button>
            )}
          </div>
        ) : (
          <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
            {t('repEmpty')}
          </div>
        )}
      </div>
    </>
  );
};
