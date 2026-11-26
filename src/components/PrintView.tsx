import React from 'react';
import { useApp } from '../context/AppContext';
import { dateStrText, fmt, getMU } from '../core/format';
import { custInvoices, custOpen, custPaid, getCust, invPaid, invRem } from '../core/ledger';

export const PrintView: React.FC = () => {
  const { db, dd, ix, curAcc, printData, t } = useApp();
  if (!db || !printData) return <div id="printArea" />;

  const mu = getMU(curAcc);

  if (printData.kind === 'customer') {
    const c = getCust(dd, printData.cid);
    if (!c) return <div id="printArea" />;
    const invs = custInvoices(dd, printData.cid);
    return (
      <div id="printArea">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '3px solid #12294a',
            paddingBottom: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#0d1f3a',
              color: '#e8c76a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            د
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#12294a' }}>{curAcc.name}</div>
            <div style={{ color: '#667', fontSize: 12 }}>
              دَفتَري Daftari · {t('printTitle')} · {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>
        <div>
          {t('cust')}: <b>{c.name}</b>
          {c.phone ? (
            <>
              {' · '}
              <span dir="ltr">{c.phone}</span>
            </>
          ) : null}
        </div>
        <div>
          {t('remaining')}:{' '}
          <b>
            {fmt(custOpen(ix, printData.cid), mu)} {curAcc.cur}
          </b>{' '}
          · {t('totalPaid')}: {fmt(custPaid(ix, printData.cid), mu)} {curAcc.cur}
        </div>
        <table>
          <thead>
            <tr>
              <th>{t('invoice')}</th>
              <th>Date</th>
              <th>{t('remind')}</th>
              <th>{t('total')}</th>
              <th>{t('paidLbl')}</th>
              <th>{t('remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {invs.map((i) => (
              <tr key={i.id}>
                <td>{i.code}</td>
                <td>{new Date(i.ts).toLocaleDateString('en-GB')}</td>
                <td>{i.note || ''}</td>
                <td>{fmt(i.amount, mu)}</td>
                <td>{fmt(invPaid(ix, i.id), mu)}</td>
                <td>{fmt(invRem(ix, i), mu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const { r, custName, rows } = printData;
  const header = rows[0] || [];
  const body = rows.slice(1);

  return (
    <div id="printArea">
      <div style={{ fontFamily: 'system-ui', direction: db.lang === 'ar' ? 'rtl' : 'ltr', padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 19, color: '#12294a' }}>
          {curAcc.name} — {t('repB')}
        </div>
        <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
          {dateStrText(r.a, db.lang)} ← {dateStrText(r.b - 1, db.lang)}
          {custName ? ` · ${custName}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 14, margin: '12px 0', fontWeight: 800, fontSize: 13 }}>
          <span style={{ color: '#a71949' }}>
            {t('repDebtSum')}: {fmt(r.debt, mu)}
          </span>
          <span style={{ color: '#0e7a52' }}>
            {t('repPaySum')}: {fmt(r.pay, mu)}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#eef2f7' }}>
              {header.map((c, idx) => (
                <th key={idx} style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {String(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #e3e6ea' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '6px 8px' }}>
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
