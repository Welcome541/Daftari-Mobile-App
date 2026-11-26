import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, DateStr, MoneyText, TimeStr } from './Formatters';
import { useApp } from '../context/AppContext';
import { cName, COUNTRIES } from '../core/i18n';
import { custOpen, getCust, getInv, getPay, invRem } from '../core/ledger';
import { fmt, getMU, Money, opHasTime } from '../core/format';
import { D } from '../core/format';
import { filteredCustomers, txAll } from '../core/queries';
import { parseSay } from '../core/recognition';
import { libLoad } from '../core/libLoader';
import { DENSITIES, SCALES } from '../core/appearance';
import type { Customer, PaymentMethod } from '../types/daftari';

const SheetHeader: React.FC<{ title: React.ReactNode; onClose?: () => void }> = ({ title, onClose }) => {
  const { closeSheet, t } = useApp();
  return (
    <div className="row" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <span className="sp" />
      <button className="hbtn" onClick={onClose || closeSheet} aria-label={t('close')}>
        <Icon name="x" size={17} />
      </button>
    </div>
  );
};

const NotificationsSheet: React.FC = () => {
  const { dd, ix, curAcc, t, go, closeSheet } = useApp();
  const mu = getMU(curAcc);
  const list = (dd.customers || [])
    .filter((c) => !c.archived && custOpen(ix, c.id) > 0)
    .sort((a, b) => custOpen(ix, b.id) - custOpen(ix, a.id));

  return (
    <>
      <SheetHeader title={t('notifT')} />
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.8 }}>
        {t('notifD')}
      </div>
      {list.length ? (
        list.map((c) => {
          const open = custOpen(ix, c.id);
          return (
            <button
              key={c.id}
              className="srow"
              onClick={() => {
                closeSheet();
                go('profile', { id: c.id });
              }}
            >
              <Avatar name={c.name} size={44} cid={c.id} />
              <span className="sp" style={{ textAlign: 'start' }}>
                <span className="t">{c.name}</span>
                <span className="d">
                  {t('totalDue')}: <span className="num">{fmt(open, mu)}</span> {curAcc.cur}
                </span>
              </span>
              <span className="amt red">
                <span className="num">{fmt(open, mu)}</span>
              </span>
            </button>
          );
        })
      ) : (
        <div className="muted" style={{ textAlign: 'center', padding: '26px 0' }}>
          {t('notifEmpty')}
        </div>
      )}
    </>
  );
};

const HomeFilterSheet: React.FC = () => {
  const { db, dd, ui, setUi, closeSheet, t } = useApp();
  if (!db) return null;
  const tx = txAll(db, dd);
  const tf = ui.tf;
  const matchingCount = tx.filter((x) => {
    if (tf.kind !== 'all' && x.kind !== tf.kind) return false;
    if (tf.period === 'today' && new Date(x.ts).toDateString() !== new Date().toDateString()) return false;
    if (tf.period === 'week' && Date.now() - x.ts >= 7 * D) return false;
    if (tf.period === 'month' && Date.now() - x.ts >= 30 * D) return false;
    return true;
  }).length;

  return (
    <>
      <SheetHeader title={t('hfTitle')} />
      <div className="lb" style={{ marginTop: 0 }}>
        {t('hfKind')}
      </div>
      <div className="seg">
        {(
          [
            ['all', `${t('all')} · ${tx.length}`],
            ['debt', `${t('debtsF')} · ${tx.filter((x) => x.kind === 'debt').length}`],
            ['pay', `${t('paysF')} · ${tx.filter((x) => x.kind === 'pay').length}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={tf.kind === k ? 'on' : ''}
            onClick={() => {
              setUi((prev) => ({ ...prev, tf: { ...prev.tf, kind: k }, txLimit: 60 }));
              closeSheet();
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lb" style={{ margin: '12px 0 7px' }}>
        {t('hfPeriod')}
      </div>
      <div className="mgrid">
        {(
          [
            ['all', `${t('pAll')} · ${tx.length}`],
            ['today', `${t('pToday')} · ${tx.filter((x) => new Date(x.ts).toDateString() === new Date().toDateString()).length}`],
            ['week', `${t('pWeek')} · ${tx.filter((x) => Date.now() - x.ts < 7 * D).length}`],
            ['month', `${t('pMonth')} · ${tx.filter((x) => Date.now() - x.ts < 30 * D).length}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={`mgrid-btn${tf.period === k ? ' on' : ''}`}
            onClick={() => {
              setUi((prev) => ({
                ...prev,
                tf: { ...prev.tf, period: prev.tf.period === k ? 'all' : k },
                txLimit: 60,
              }));
              closeSheet();
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="muted" style={{ marginTop: 12, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
        <span className="num">{matchingCount}</span> {t('hfShow')}
      </div>

      {(tf.kind !== 'all' || tf.period !== 'all') && (
        <button
          className="btn btn-line"
          style={{ marginTop: 10 }}
          onClick={() => {
            setUi((prev) => ({ ...prev, tf: { kind: 'all', period: 'all' }, txLimit: 60 }));
            closeSheet();
          }}
        >
          <Icon name="x" size={15} /> {t('clearF')}
        </button>
      )}
    </>
  );
};

const InvEditSheet: React.FC<{ invId: string }> = ({ invId }) => {
  const { dd, curAcc, t, saveInvEdit, closeSheet } = useApp();
  const inv = getInv(dd, invId);
  const mu = getMU(curAcc);
  const [amtStr, setAmtStr] = useState(inv ? fmt(inv.amount, mu) : '');
  const [note, setNote] = useState(inv?.note || '');

  if (!inv) return null;
  return (
    <>
      <SheetHeader
        title={
          <>
            {t('invEditT')} <span className="num">{inv.code}</span>
          </>
        }
      />
      <label className="lb">
        {t('debtAmt')} ({curAcc.cur})
      </label>
      <input
        className="inp num"
        inputMode="decimal"
        value={amtStr}
        onChange={(e) => setAmtStr(e.target.value)}
      />
      <label className="lb">
        {t('remind')} — {t('optF')}
      </label>
      <input
        className="inp"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('remindPh')}
      />
      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
          {t('cancel')}
        </button>
        <button
          className="btn btn-navy"
          style={{ flex: 1.4 }}
          onClick={() => saveInvEdit(invId, Money.parse(amtStr, mu), note)}
        >
          <Icon name="save" size={17} /> {t('saveC')}
        </button>
      </div>
    </>
  );
};

const ReturnAdjustSheet: React.FC<{ invId: string }> = ({ invId }) => {
  const { dd, ix, curAcc, t, applyReturn } = useApp();
  const inv = getInv(dd, invId);
  const mu = getMU(curAcc);
  const [amtStr, setAmtStr] = useState('');
  const [note, setNote] = useState('');
  if (!inv) return null;
  const rem = invRem(ix, inv);
  return (
    <>
      <h3>
        {t('retT')} — {inv.code}
      </h3>
      <div className="muted" style={{ marginBottom: 10 }}>
        {t('retHint')}
      </div>
      <div className="kv">
        <span className="k">{t('remaining')}</span>
        <span className="v amt red">
          <MoneyText amount={rem} />
        </span>
      </div>
      <input
        className="inp num"
        type="number"
        inputMode="decimal"
        value={amtStr}
        onChange={(e) => setAmtStr(e.target.value)}
        placeholder={t('retAmt')}
      />
      <input
        className="inp"
        style={{ marginTop: 8 }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('retNote')}
      />
      <button
        className="btn"
        style={{ marginTop: 12, background: 'var(--amber-bg)', color: 'var(--amber)' }}
        onClick={() => applyReturn(invId, Money.parse(amtStr, mu), note)}
      >
        <Icon name="undo" size={16} />
        {t('ret')}
      </button>
    </>
  );
};

const OpeningBalanceSheet: React.FC<{ cid: string }> = ({ cid }) => {
  const { curAcc, t, addOpening, closeSheet, toastMsg } = useApp();
  const [amtStr, setAmtStr] = useState('');
  const mu = getMU(curAcc);
  return (
    <>
      <h3>{t('opening')}</h3>
      <div className="muted" style={{ marginBottom: 10 }}>
        {t('openingD')}
      </div>
      <input
        className="inp num"
        type="number"
        inputMode="decimal"
        placeholder="0.00"
        value={amtStr}
        onChange={(e) => setAmtStr(e.target.value)}
      />
      <button
        className="btn btn-navy"
        style={{ marginTop: 12 }}
        onClick={() => {
          const a = Money.parse(amtStr, mu);
          if (a <= 0) {
            toastMsg(t('enterAmt'));
            return;
          }
          closeSheet();
          addOpening(cid, a);
        }}
      >
        {t('saveName')}
      </button>
    </>
  );
};

const QuickPaySheet: React.FC<{ cid: string }> = ({ cid }) => {
  const { dd, curAcc, t, quickPaySave } = useApp();
  const c = getCust(dd, cid);
  const [amtStr, setAmtStr] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const mu = getMU(curAcc);
  if (!c) return null;
  return (
    <>
      <h3>
        {t('quickPay')} — {c.name}
      </h3>
      <input
        className="inp num"
        type="number"
        inputMode="decimal"
        placeholder="0.00"
        value={amtStr}
        onChange={(e) => setAmtStr(e.target.value)}
      />
      <div className="seg" style={{ marginTop: 10 }}>
        {(['cash', 'transfer', 'cardpay'] as PaymentMethod[]).map((m) => (
          <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
            {t(m)}
          </button>
        ))}
      </div>
      <button
        className="btn btn-green"
        style={{ marginTop: 12 }}
        onClick={() => quickPaySave(cid, Money.parse(amtStr, mu), method)}
      >
        <Icon name="checkc" size={18} />
        {t('confirmPay')}
      </button>
    </>
  );
};

const AccountSwitcherSheet: React.FC = () => {
  const { db, t, switchAcc, saveAccEdit } = useApp();
  const [editId, setEditId] = useState<string | null>(null);
  const [accTy, setAccTy] = useState<'grocery' | 'personal'>('grocery');
  const [accName, setAccName] = useState('');
  const [accCur, setAccCur] = useState(db?.lang === 'ar' ? 'ر.س' : '$');

  if (!db) return null;

  const startEdit = (id: string) => {
    if (id === 'new') {
      setEditId('new');
      setAccTy('grocery');
      setAccName('');
      setAccCur(db.lang === 'ar' ? 'ر.س' : '$');
    } else {
      const a = db.accounts.find((x) => x.id === id);
      if (!a) return;
      setEditId(a.id);
      setAccTy(a.type);
      setAccName(a.name);
      setAccCur(a.cur);
    }
  };

  return (
    <>
      <SheetHeader title={t('accT')} />
      {!editId ? (
        <>
          {db.accounts
            .filter((x) => x.type === 'grocery' || x.id === db.active)
            .map((x) => {
              const ad = db.data[x.id] || { customers: [] };
              const cn = (ad.customers || []).filter((c) => !c.archived).length;
              return (
                <div key={x.id} className="srow" style={{ cursor: 'pointer' }} onClick={() => switchAcc(x.id)}>
                  <span
                    className="sic2"
                    style={{
                      background: x.type === 'grocery' ? 'var(--green-bg)' : '#eef1f5',
                      color: x.type === 'grocery' ? 'var(--green)' : undefined,
                    }}
                  >
                    <Icon name={x.type === 'grocery' ? 'store' : 'user'} size={20} />
                  </span>
                  <span className="sp" style={{ textAlign: 'start' }}>
                    <span className="t">{x.name}</span>
                    <span className="d">
                      {x.type === 'grocery' ? t('grocery') : t('personal')} · <span className="num">{cn}</span>{' '}
                      {t('customers')} · {x.cur}
                    </span>
                  </span>
                  {x.id === db.active && <Icon name="checkc" size={20} />}
                  <button
                    className="hbtn"
                    style={{ minWidth: 36, height: 36, border: 'none', boxShadow: 'none', background: 'transparent' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(x.id);
                    }}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                </div>
              );
            })}
          <button className="btn btn-navy" style={{ marginTop: 6 }} onClick={() => startEdit('new')}>
            <Icon name="plus" size={17} />
            {t('addAcc')}
          </button>
        </>
      ) : (
        <>
          <div className="lb" style={{ marginTop: 0 }}>
            {editId === 'new' ? t('addAcc') : t('editAcc')}
          </div>
          <input
            className="inp"
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
            placeholder={db.lang === 'ar' ? 'مثال: بقالة الحي' : 'e.g. Main store'}
          />
          <select className="inp" style={{ marginTop: 10 }} value={accCur} onChange={(e) => setAccCur(e.target.value)}>
            {['ر.س', '$', '€', '£', 'د.إ', '₺'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            className="btn btn-navy"
            style={{ marginTop: 12 }}
            onClick={() => saveAccEdit(editId, accName, accTy, accCur)}
          >
            <Icon name="save" size={17} />
            {t('saveName')}
          </button>
          <button className="btn btn-soft" style={{ marginTop: 8 }} onClick={() => setEditId(null)}>
            <Icon name="back" size={16} />
            {t('cancel')}
          </button>
        </>
      )}
    </>
  );
};

const PaperLedgerSheet: React.FC = () => {
  const { db, dd, curAcc, sec, t, paperCommit } = useApp();
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [txt, setTxt] = useState('');
  const [drafts, setDrafts] = useState<{ say: string; name: string; amt: number; note: string; ok: boolean }[] | null>(null);
  const mu = getMU(curAcc);

  const review = () => {
    const rows = txt
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    const list = rows.map((r) => {
      const pr = parseSay(r, dd, sec, mu);
      return { say: r, name: pr.name || r, amt: pr.amt || 0, note: pr.note || '', ok: !!(pr.name && pr.amt > 0) };
    });
    setDrafts(list);
  };

  return (
    <>
      <h3>{t('paperT')}</h3>
      <div className="muted" style={{ marginBottom: 8 }}>
        {t('paperD')}
      </div>
      <div className="lb">{t('paperDate')}</div>
      <input className="inp num" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
      <textarea
        className="inp"
        rows={6}
        style={{ marginTop: 8 }}
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder={db?.lang === 'ar' ? 'أبو خالد سبعين رز وحليب' : 'Abu Khaled seventy'}
      />
      <button className="btn btn-navy" style={{ marginTop: 10 }} onClick={review}>
        {t('paperGo')}
      </button>
      {drafts && (
        <div style={{ marginTop: 10 }}>
          {drafts.map((d, i) => (
            <div key={i} className="kv" style={{ padding: '6px 0' }}>
              <span
                className="kic"
                style={{
                  background: d.ok ? 'var(--green-bg)' : 'var(--amber-bg)',
                  color: d.ok ? 'var(--green)' : 'var(--amber)',
                }}
              >
                {d.ok ? '✓' : '!'}
              </span>
              <span className="k">
                {d.name}
                <div className="muted" style={{ fontSize: 11 }}>
                  {d.note}
                </div>
              </span>
              <span className="v amt">{d.ok ? fmt(d.amt, mu) : t('needsRev')}</span>
            </div>
          ))}
          <button className="btn btn-green" style={{ marginTop: 10 }} onClick={() => paperCommit(drafts, dateStr)}>
            {t('importGo')}
          </button>
        </div>
      )}
    </>
  );
};

const ImportLedgerSheet: React.FC = () => {
  const { db, t, importRows, ocrPick, openSheet, toastMsg } = useApp();
  const [txt, setTxt] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      if (!(window as any).XLSX) {
        try {
          await libLoad('lib/xlsx.full.min.js');
        } catch {
          toastMsg(t('xlNo'));
          return;
        }
      }
      try {
        const buf = await f.arrayBuffer();
        const XLSX = (window as any).XLSX;
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        importRows(XLSX.utils.sheet_to_json(ws, { header: 1 }));
      } catch {
        toastMsg(t('btFail'));
      }
      return;
    }
    const content = await f.text();
    setTxt(content);
  };

  return (
    <>
      <h3>{t('importT')}</h3>
      <div className="muted" style={{ marginBottom: 10 }}>
        {t('importD')}
      </div>
      <textarea
        className="inp"
        rows={7}
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder={db?.lang === 'ar' ? 'أبو خالد، 50، رز وحليب\nسارة أحمد، 120، سكر وشاي' : 'Abu Khaled, 50, rice & milk'}
      />
      <input type="file" accept=".txt,.csv,.xls,.xlsx" style={{ marginTop: 10 }} onChange={handleFile} />
      <button className="btn btn-soft" style={{ marginTop: 10 }} onClick={ocrPick}>
        <Icon name="cam" size={17} />
        {t('ocrBtn')}
      </button>
      <button className="btn btn-soft" style={{ marginTop: 10 }} onClick={() => openSheet({ type: 'paperLedger' })}>
        <Icon name="mic" size={17} />
        {t('paperT')}
      </button>
      <button
        className="btn btn-navy"
        style={{ marginTop: 12 }}
        onClick={() => importRows(txt.split(/\n+/).map((l) => l.split(/[,،;\t]+/)))}
      >
        <Icon name="up" size={17} />
        {t('importGo')}
      </button>
    </>
  );
};

const QrSvgSheet: React.FC<{ title: string; data: string; hint: string; extraText?: string }> = ({
  title,
  data,
  hint,
  extraText,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  useEffect(() => {
    try {
      const qrcodeFn = (window as any).qrcode;
      if (qrcodeFn) {
        const q = qrcodeFn(0, 'L');
        q.addData(data, 'Byte');
        q.make();
        setQrUrl(q.createDataURL(6, 4));
      }
    } catch {
      // ignore
    }
  }, [data]);

  return (
    <>
      <SheetHeader title={title} />
      <div
        className="card"
        style={{ padding: 16, background: '#fff', display: 'flex', justifyContent: 'center' }}
        dir="ltr"
      >
        {qrUrl && <img src={qrUrl} alt={String(title)} style={{ width: 220, height: 220, imageRendering: 'pixelated' }} />}
      </div>
      <div className="muted" style={{ textAlign: 'center', marginTop: 10, lineHeight: 1.8, fontSize: 12.5 }}>
        {hint}
      </div>
      {extraText && (
        <div
          className="transcript"
          style={{ marginTop: 12, maxHeight: 130, overflow: 'auto', whiteSpace: 'pre-line', textAlign: 'start' }}
        >
          {extraText}
        </div>
      )}
    </>
  );
};

const QrRecvSheet: React.FC = () => {
  const { t, closeSheet, qrApply, toastMsg } = useApp();
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;

    (async () => {
      try {
        await libLoad('lib/jsQR.js');
        if (!navigator.mediaDevices) throw new Error('no-cam');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (vidRef.current) {
          vidRef.current.srcObject = stream;
        }
        const cv = document.createElement('canvas');
        const cx = cv.getContext('2d');
        timer = window.setInterval(() => {
          const v = vidRef.current;
          const jsQR = (window as any).jsQR;
          if (!v || !v.videoWidth || !cx || !jsQR) return;
          cv.width = v.videoWidth;
          cv.height = v.videoHeight;
          cx.drawImage(v, 0, 0);
          const res = jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
          if (res && res.data) {
            if (timer) clearInterval(timer);
            stream?.getTracks().forEach((tr) => tr.stop());
            closeSheet();
            qrApply(res.data);
          }
        }, 400);
      } catch {
        toastMsg(t('qrCam'));
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [closeSheet, qrApply, t, toastMsg]);

  return (
    <>
      <SheetHeader title={t('qrRecv')} />
      <div className="card" style={{ overflow: 'hidden' }}>
        <video ref={vidRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
      </div>
      <div className="muted" style={{ textAlign: 'center', margin: '10px 0' }}>
        {t('qrScan')}
      </div>
    </>
  );
};

const PinSetupSheet: React.FC = () => {
  const { t, setPin, closeSheet } = useApp();
  const [pinVal, setPinVal] = useState('');
  const valid = /^\d{4}$/.test(pinVal);
  return (
    <>
      <SheetHeader title={t('pinLock')} />
      <label className="lb">{t('newPinPrompt')}</label>
      <input
        className="inp num"
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pinVal}
        onChange={(e) => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="••••"
      />
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
          {t('cancel')}
        </button>
        <button
          className="btn btn-navy"
          style={{ flex: 1.4, opacity: valid ? 1 : 0.5 }}
          disabled={!valid}
          onClick={() => setPin(pinVal)}
        >
          <Icon name="lock" size={16} /> {t('saveName')}
        </button>
      </div>
    </>
  );
};

const PhotoPickerSheet: React.FC<{ target: string }> = ({ target }) => {
  const { dd, ui, t, setPhoto, toastMsg } = useApp();
  const c = target === 'nc' ? null : getCust(dd, target);
  const hasPhoto = target === 'nc' ? !!ui.nc.photo : !!(c && c.photo);

  const pickFile = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const S = 96;
            const cnv = document.createElement('canvas');
            cnv.width = S;
            cnv.height = S;
            const g = cnv.getContext('2d');
            if (!g) throw new Error('no-ctx');
            const m = Math.min(img.width, img.height) || 1;
            g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
            setPhoto(target, cnv.toDataURL('image/jpeg', 0.82));
          } catch {
            toastMsg(t('btFail'));
          }
        };
        img.onerror = () => toastMsg(t('btFail'));
        img.src = String(r.result || '');
      };
      r.readAsDataURL(f);
    };
    inp.click();
  };

  return (
    <>
      <h3>{t('photoT')}</h3>
      <button className="srow" onClick={pickFile}>
        <span className="sic2" style={{ background: 'var(--navy-bg)', color: 'var(--navy)' }}>
          <Icon name="cam" size={20} />
        </span>
        <span className="sp" style={{ textAlign: 'start' }}>
          <span className="t">{t('photoAdd')}</span>
          <span className="d">{t('photoD')}</span>
        </span>
        <Icon name="fwd" size={17} />
      </button>
      {hasPhoto && (
        <button className="srow" onClick={() => setPhoto(target, null)}>
          <span className="sic2" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
            <Icon name="trash" size={20} />
          </span>
          <span className="sp" style={{ textAlign: 'start' }}>
            <span className="t">{t('photoDel')}</span>
          </span>
        </button>
      )}
    </>
  );
};

export const SheetsRenderer: React.FC = () => {
  const {
    sheet,
    closeSheet,
    openSheet,
    db,
    dd,
    ix,
    curAcc,
    ui,
    setUi,
    t,
    go,
    goWiz,
    resetStack,
    selStart,
    exportAll,
    togglePin,
    archiveCustomer,
    restoreCustomer,
    shareCustomerReceipt,
    shareOneById,
    exportCustCsv,
    sendWA,
    sendSMS,
    waRemindInv,
    applyDemo,
    clearDemo,
    extSay,
    toastMsg,
    setCur,
    isP,
    appearance,
    setAppearanceValues,
    updater,
    checkUpdates,
    saveCustomer,
    resetAll,
    trashPurge,
    startRec,
  } = useApp() as any;

  const [extText, setExtText] = useState('');
  const [curInput, setCurInput] = useState(curAcc?.cur || '');

  useEffect(() => {
    if (sheet?.type === 'customCur') setCurInput(curAcc.cur);
    if (sheet?.type === 'extVoice') setExtText('');
  }, [sheet, curAcc.cur]);

  if (!sheet || !db) return null;
  const mu = getMU(curAcc);

  switch (sheet.type) {
    case 'notifications':
      return <NotificationsSheet />;

    case 'homeMenu': {
      const hfCount = (ui.tf.kind !== 'all' ? 1 : 0) + (ui.tf.period !== 'all' ? 1 : 0);
      return (
        <>
          <SheetHeader title={t('menu')} />
          <div className="mgroup">
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                selStart();
              }}
            >
              <span className="mic">
                <Icon name="checkc" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('sel')}</span>
                <span className="md">{t('selDesc')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button className="mrow" onClick={() => openSheet({ type: 'homeFilter' })}>
              <span className="mic">
                <Icon name="sliders" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('hfTitle')}</span>
                <span className="md">{t('hfDesc')}</span>
              </span>
              {hfCount > 0 && <span className="mbadge num">{hfCount}</span>}
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            {!isP && (
              <button
                className="mrow"
                onClick={() => {
                  closeSheet();
                  go('repb', {});
                }}
              >
                <span className="mic">
                  <Icon name="pie" size={19} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('repB')}</span>
                  <span className="md">{t('repBDesc')}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </button>
            )}
          </div>
          <div className="mgroup">
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                exportAll();
              }}
            >
              <span className="mic green">
                <Icon name="excel" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('exportAll')}</span>
                <span className="md">{t('exportAllDesc')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            {!isP && (
              <button className="mrow" onClick={() => openSheet({ type: 'paperLedger' })}>
                <span className="mic amber">
                  <Icon name="cam" size={19} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('paperGo')}</span>
                  <span className="md">{t('paperD')}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </button>
            )}
          </div>
        </>
      );
    }

    case 'homeFilter':
      return <HomeFilterSheet />;

    case 'custListMenu': {
      const n = filteredCustomers(dd, ix, ui.f, ui.cq).length;
      const archCount = (dd.customers || []).filter((c: Customer) => c.archived).length;
      const pinnedCount = (dd.customers || []).filter((c: Customer) => !c.archived && c.pinned).length;
      const hasFilter = ui.f.status !== 'all' || ui.f.sort !== 'recent';
      const showNFn = t('showN');
      return (
        <>
          <div className="row" style={{ marginBottom: 8, gap: 8 }}>
            <h3 style={{ margin: 0 }}>{t('custMenu')}</h3>
            <span className="sp" />
            {hasFilter && (
              <button
                className="btn btn-line"
                style={{ width: 'auto', minHeight: 34, padding: '5px 11px', fontSize: 12 }}
                onClick={() =>
                  setUi((prev: any) => ({ ...prev, f: { ...prev.f, status: 'all', sort: 'recent' }, cmax: 60 }))
                }
              >
                {t('resetF')}
              </button>
            )}
            <button className="hbtn" onClick={closeSheet} aria-label={t('close')}>
              <Icon name="x" size={17} />
            </button>
          </div>

          <div className="msection-hdr" style={{ marginTop: 4 }}>
            <span>{t('status')}</span>
          </div>
          <div className="seg">
            {(
              [
                ['all', t('all')],
                ['owed', t('owedF')],
                ['noDebt', t('noDebtF')],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                className={ui.f.status === k ? 'on' : ''}
                onClick={() => setUi((prev: any) => ({ ...prev, f: { ...prev.f, status: k }, cmax: 60 }))}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="msection-hdr" style={{ marginTop: 14 }}>
            <span>{t('sortBy')}</span>
          </div>
          <div className="mgrid" style={{ marginBottom: 14 }}>
            {(
              [
                ['recent', t('sRecent')],
                ['debt', t('sDebt')],
                ['low', t('sortLowF')],
                ['name', t('sortNameF')],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                className={`mgrid-btn ${ui.f.sort === k ? 'on' : ''}`}
                onClick={() => setUi((prev: any) => ({ ...prev, f: { ...prev.f, sort: k }, cmax: 60 }))}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="mgroup">
            <button className="mrow" onClick={() => openSheet({ type: 'custPin' })}>
              <span className="mic amber">
                <Icon name="pin" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('pinCust')}</span>
                <span className="md">{t('pinPickHint')}</span>
              </span>
              {pinnedCount > 0 && <span className="mbadge num">{pinnedCount}</span>}
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                setUi((prev: any) => ({ ...prev, arch: true, archQ: '' }));
              }}
            >
              <span className="mic">
                <Icon name="archive" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('archListT')}</span>
                <span className="md">{t('archListDesc')}</span>
              </span>
              {archCount > 0 && <span className="mbadge num">{archCount}</span>}
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                setUi((prev: any) => ({
                  ...prev,
                  nc: { name: '', phone: '', limit: '', photo: null, edit: null, forceDup: false },
                }));
                go('newcust', {});
              }}
            >
              <span className="mic green">
                <Icon name="userplus" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('addC')}</span>
                <span className="md">{t('custAddDesc')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
          </div>

          <button className="btn btn-navy" style={{ marginTop: 4 }} onClick={closeSheet}>
            {typeof showNFn === 'function' ? showNFn(n) : n}
          </button>
        </>
      );
    }

    case 'custPin': {
      const cs = (dd.customers || [])
        .filter((c: Customer) => !c.archived)
        .sort((a: Customer, b: Customer) => String(a.name).localeCompare(String(b.name), 'ar'));
      return (
        <>
          <SheetHeader title={t('pinCust')} />
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.7 }}>
            {t('pinPickHint')}
          </div>
          {cs.length ? (
            <div className="mgroup">
              {cs.map((c: Customer) => (
                <button
                  key={c.id}
                  className="mrow"
                  onClick={() => {
                    togglePin(c.id);
                    closeSheet();
                  }}
                >
                  <Avatar name={c.name} size={40} cid={c.id} />
                  <span className="mtxt">
                    <span className="mt">{c.name}</span>
                    <span className="md">{c.pinned ? t('pinned') : t('pinU')}</span>
                  </span>
                  {c.pinned ? (
                    <span className="mic amber" style={{ width: 34, height: 34 }}>
                      <Icon name="pinf" size={17} />
                    </span>
                  ) : (
                    <Icon name="fwd" size={16} className="mchev" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ textAlign: 'center', padding: '26px 0' }}>
              {t('noCustomers')}
            </div>
          )}
        </>
      );
    }

    case 'custSort': {
      const n = filteredCustomers(dd, ix, ui.f, ui.cq).length;
      const showNFn = t('showN');
      return (
        <>
          <SheetHeader title={t('sortBy')} />
          <div className="lb" style={{ margin: '0 0 7px' }}>
            {t('sort')}
          </div>
          <div className="seg">
            {(
              [
                ['recent', t('sRecent')],
                ['debt', t('sDebt')],
                ['low', t('sortLowF')],
                ['name', t('sortNameF')],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                className={ui.f.sort === k ? 'on' : ''}
                onClick={() => setUi((prev: any) => ({ ...prev, f: { ...prev.f, sort: k }, cmax: 60 }))}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-line"
              style={{ flex: 1 }}
              onClick={() => setUi((prev: any) => ({ ...prev, f: { ...prev.f, sort: 'recent' }, cmax: 60 }))}
            >
              {t('clearF')}
            </button>
            <button className="btn btn-navy" style={{ flex: 1.4 }} onClick={closeSheet}>
              {typeof showNFn === 'function' ? showNFn(n) : n}
            </button>
          </div>
        </>
      );
    }

    case 'custProfileMenu': {
      const c = getCust(dd, sheet.cid);
      if (!c) return null;
      const open = custOpen(ix, c.id);
      return (
        <>
          <div className="row" style={{ marginBottom: 14, gap: 10 }}>
            <div className="mcust-pill">
              <Avatar name={c.name} size={38} cid={c.id} />
              <span>{c.name}</span>
            </div>
            <button className="hbtn" onClick={closeSheet} aria-label={t('close')}>
              <Icon name="x" size={17} />
            </button>
          </div>

          <div className="mgroup">
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                setUi((prev: any) => ({ ...prev, nc: { name: '', phone: '', edit: c.id, photo: null } }));
                go('newcust', { edit: c.id });
              }}
            >
              <span className="mic">
                <Icon name="edit" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('editC')}</span>
                <span className="md">{t('editCDesc')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>

            {open > 0 && !c.archived && (
              <button className="mrow" onClick={() => openSheet({ type: 'quickPay', cid: c.id })}>
                <span className="mic green">
                  <Icon name="coins" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('quickPay')}</span>
                  <span className="md">{t('quickPayDesc')}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </button>
            )}

            {!c.archived && (
              <button className="mrow" onClick={() => openSheet({ type: 'openingBalance', cid: c.id })}>
                <span className="mic amber">
                  <Icon name="hist" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('opening')}</span>
                  <span className="md">{t('openingD')}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </button>
            )}

            <button
              className="mrow"
              onClick={() => {
                togglePin(c.id);
                closeSheet();
              }}
            >
              <span className={`mic ${c.pinned ? 'amber' : ''}`}>
                <Icon name={c.pinned ? 'pinf' : 'pin'} size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{c.pinned ? t('unpinAct') : t('pinAct')}</span>
                <span className="md">{t('pinPickHint')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
          </div>

          <div className="mgroup">
            <button className="mrow" onClick={() => openSheet({ type: 'exportCustomer', cid: c.id })}>
              <span className="mic">
                <Icon name="share" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('shareExp')}</span>
                <span className="md">{t('shareExpD')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
          </div>

          <div className="mgroup">
            {c.archived ? (
              <button
                className="mrow"
                onClick={() => {
                  restoreCustomer(c.id);
                  closeSheet();
                }}
              >
                <span className="mic green">
                  <Icon name="undo" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt green">{t('restore')}</span>
                  <span className="md">{t('restoreDesc')}</span>
                </span>
              </button>
            ) : (
              <button className="mrow" onClick={() => openSheet({ type: 'confirmArchive', cid: c.id })}>
                <span className="mic red">
                  <Icon name="archive" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt red">{t('archC')}</span>
                  <span className="md">{t('archD')}</span>
                </span>
              </button>
            )}
          </div>

          <div className="muted" style={{ textAlign: 'center', marginTop: 4, fontSize: 11.5 }}>
            <Icon name="shield" size={13} /> {t('deletedKeep')}
          </div>
        </>
      );
    }

    case 'invMenu': {
      const inv = getInv(dd, sheet.invId);
      if (!inv) return null;
      const c = getCust(dd, inv.cust);
      const rem = invRem(ix, inv);
      return (
        <>
          <SheetHeader
            title={
              <>
                {t('invOpts')} · <span className="num">{inv.code}</span>
              </>
            }
          />
          <div className="mgroup">
            <button className="mrow" onClick={() => openSheet({ type: 'invEdit', invId: inv.id })}>
              <span className="mic">
                <Icon name="edit" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('invEditT')}</span>
                <span className="md">{t('invEditDesc')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button className="mrow" onClick={() => openSheet({ type: 'returnAdjust', invId: inv.id })}>
              <span className="mic amber">
                <Icon name="undo" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('retT')}</span>
                <span className="md">{t('retHint')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            {rem > 0 && (
              <button
                className="mrow"
                onClick={() => {
                  closeSheet();
                  goWiz('pay', c ? c.id : null);
                }}
              >
                <span className="mic green">
                  <Icon name="coins" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('payRemaining')}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </button>
            )}
          </div>

          <div className="mgroup">
            {c && c.phone && rem > 0 && (
              <button
                className="mrow"
                onClick={() => {
                  closeSheet();
                  waRemindInv(inv.id);
                }}
              >
                <span className="mic green">
                  <Icon name="wa" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('waRemind')}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </button>
            )}
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                shareOneById(`d:${inv.id}`);
              }}
            >
              <span className="mic">
                <Icon name="share" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('shareReceipt')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            {c && (
              <>
                <button className="mrow" onClick={() => openSheet({ type: 'exportCustomer', cid: c.id })}>
                  <span className="mic green">
                    <Icon name="excel" size={18} />
                  </span>
                  <span className="mtxt">
                    <span className="mt">{t('exportT')}</span>
                    <span className="md">{t('shareExpD')}</span>
                  </span>
                  <Icon name="fwd" size={16} className="mchev" />
                </button>
                <button
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    go('profile', { id: c.id });
                  }}
                >
                  <span className="mic">
                    <Icon name="user" size={18} />
                  </span>
                  <span className="mtxt">
                    <span className="mt">{t('openAcc2')}</span>
                    <span className="md">{c.name}</span>
                  </span>
                  <Icon name="fwd" size={16} className="mchev" />
                </button>
              </>
            )}
          </div>
        </>
      );
    }

    case 'confirmArchive': {
      const c = getCust(dd, sheet.cid);
      if (!c) return null;
      const o = custOpen(ix, c.id);
      const archBalFn = t('archBal');
      return (
        <>
          <h3>{t('archConf')}</h3>
          <div style={{ fontWeight: 800, margin: '6px 0' }}>{c.name}</div>
          {o > 0 ? (
            <>
              <div
                className="card"
                style={{ padding: '12px 14px', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 800 }}
              >
                {typeof archBalFn === 'function' ? archBalFn(`${fmt(o, mu)} ${curAcc.cur}`) : `${fmt(o, mu)} ${curAcc.cur}`}
              </div>
              <div className="muted" style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('archKeep')}
              </div>
            </>
          ) : (
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
              {t('archZero')}
            </div>
          )}
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
              {t('cancel')}
            </button>
            <button className="btn btn-navy" style={{ flex: 1 }} onClick={() => archiveCustomer(c.id)}>
              {t('archGo')}
            </button>
          </div>
        </>
      );
    }

    case 'confirmRestore':
      return (
        <>
          <h3>{t('restoreQ')}</h3>
          <div className="muted" style={{ marginTop: 6 }}>
            {t('restoreD')}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
              {t('cancel')}
            </button>
            <button className="btn btn-navy" style={{ flex: 1 }} onClick={() => restoreCustomer(sheet.cid)}>
              {t('restore')}
            </button>
          </div>
        </>
      );

    case 'exportCustomer': {
      const c = getCust(dd, sheet.cid);
      if (!c) return null;
      return (
        <>
          <SheetHeader
            title={
              <>
                {t('exportT')} — {c.name}
              </>
            }
          />
          <div className="mgroup">
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                shareCustomerReceipt(c.id);
              }}
            >
              <span className="mic">
                <Icon name="share" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('stTxt')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                exportCustCsv(c.id);
              }}
            >
              <span className="mic green">
                <Icon name="excel" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('stXls')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            {c.phone && (
              <>
                <button
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    sendWA(c.id);
                  }}
                >
                  <span className="mic green">
                    <Icon name="wa" size={18} />
                  </span>
                  <span className="mtxt">
                    <span className="mt">{t('sendWa')}</span>
                  </span>
                  <Icon name="fwd" size={16} className="mchev" />
                </button>
                <button
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    sendSMS(c.id);
                  }}
                >
                  <span className="mic">
                    <Icon name="sms" size={18} />
                  </span>
                  <span className="mtxt">
                    <span className="mt">{t('sendSms')}</span>
                  </span>
                  <Icon name="fwd" size={16} className="mchev" />
                </button>
              </>
            )}
          </div>
        </>
      );
    }

    case 'photoPicker':
      return <PhotoPickerSheet target={sheet.target} />;

    case 'openingBalance':
      return <OpeningBalanceSheet cid={sheet.cid} />;

    case 'returnAdjust':
      return <ReturnAdjustSheet invId={sheet.invId} />;

    case 'invEdit':
      return <InvEditSheet invId={sheet.invId} />;

    case 'payDetails': {
      const p = getPay(dd, sheet.payId);
      if (!p) return null;
      return (
        <>
          <SheetHeader title={t('payDet')} />
          <div className="muted" style={{ marginBottom: 10 }}>
            <DateStr ts={p.ts} />
            {opHasTime(p) ? (
              <>
                {' '}
                · <TimeStr ts={p.ts} />
              </>
            ) : null}{' '}
            · <MoneyText amount={p.amount} />
          </div>
          {p.alloc && p.alloc.length ? (
            p.alloc.map((a) => {
              const i = getInv(dd, a.inv);
              return (
                <button
                  key={a.inv}
                  className="srow"
                  onClick={() => {
                    closeSheet();
                    go('invoice', { id: a.inv });
                  }}
                >
                  <span className="sic2">
                    <Icon name="receipt" size={18} />
                  </span>
                  <span className="sp" style={{ textAlign: 'start' }}>
                    <span className="t">
                      {t('invoice')}
                      {i ? (
                        <>
                          {' '}
                          <span className="num">{i.code}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="amt green">
                    <MoneyText amount={a.amt} />
                  </span>
                </button>
              );
            })
          ) : (
            <div className="muted">{t('noRes')}</div>
          )}
        </>
      );
    }

    case 'accountSwitcher':
      return <AccountSwitcherSheet />;

    case 'paperLedger':
      return <PaperLedgerSheet />;

    case 'importLedger':
      return <ImportLedgerSheet />;

    case 'demoData':
      return (
        <>
          <SheetHeader title={t('demoT')} />
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.9, marginBottom: 14 }}>
            {t('demoD')}
          </div>
          <button className="btn btn-navy" onClick={applyDemo}>
            <Icon name="zap" size={17} /> {t('demoLoad')}
          </button>
          <button className="btn btn-red" style={{ marginTop: 10 }} onClick={clearDemo}>
            <Icon name="trash" size={17} /> {t('demoClear')}
          </button>
        </>
      );

    case 'extVoice':
      return (
        <>
          <SheetHeader title={t('extT')} />
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 8 }}>
            {t('extD')}
          </div>
          <textarea
            className="inp"
            style={{ minHeight: 90, resize: 'vertical' }}
            placeholder={t('extPh')}
            value={extText}
            onChange={(e) => setExtText(e.target.value)}
          />
          <button
            className="btn btn-navy"
            style={{ marginTop: 10 }}
            onClick={() => {
              if (extSay(extText)) {
                closeSheet();
              } else {
                toastMsg(t('warn_nospeech'));
              }
            }}
          >
            <Icon name="mic" size={16} /> {t('extGo')}
          </button>
        </>
      );

    case 'customCur':
      return (
        <>
          <h3>{t('curCustom')}</h3>
          <input
            className="inp"
            value={curInput}
            maxLength={12}
            onChange={(e) => setCurInput(e.target.value)}
          />
          <button
            className="btn btn-navy"
            style={{ marginTop: 12 }}
            onClick={() => {
              const v = curInput.trim();
              if (v) setCur(v);
              closeSheet();
            }}
          >
            <Icon name="checkc" size={16} />
            {t('saveName')}
          </button>
        </>
      );

    case 'appearance':
      return (
        <>
          <SheetHeader title={t('appearT')} />
          <div className="lb" style={{ marginTop: 4 }}>
            {t('uiScaleT')}
          </div>
          <div className="seg">
            {SCALES.map((x) => (
              <button
                key={x.v}
                className={Math.abs(appearance.scale - x.v) < 0.03 ? 'on' : ''}
                onClick={() => setAppearanceValues(x.v, appearance.density)}
              >
                {t(x.k)}
              </button>
            ))}
          </div>
          <div className="lb">{t('uiDensityT')}</div>
          <div className="seg">
            {DENSITIES.map((x) => (
              <button
                key={x.v}
                className={Math.abs(appearance.density - x.v) < 0.03 ? 'on' : ''}
                onClick={() => setAppearanceValues(appearance.scale, x.v)}
              >
                {t(x.k)}
              </button>
            ))}
          </div>
        </>
      );

    case 'updater': {
      const v = (updater.manifest && updater.manifest.version) || '3.0.0';
      return (
        <>
          <SheetHeader title={t('updT')} />
          <div className="card" style={{ padding: '4px 14px' }}>
            <div className="kv">
              <span className="k">{t('ver')}</span>
              <span className="v num">{v}</span>
            </div>
            {updater.manifest?.build ? (
              <div className="kv">
                <span className="k">{t('updBundle')}</span>
                <span className="v num">#{updater.manifest.build}</span>
              </div>
            ) : null}
            {updater.manifest?.channel ? (
              <div className="kv">
                <span className="k">{t('updSource')}</span>
                <span className="v">{updater.manifest.channel}</span>
              </div>
            ) : null}
            <div className="sep" />
            <div className="kv">
              <span className="k">{t('updCheck')}</span>
              <span className="v">{updater.state === 'error' ? t('updCheckFail') : t('updUpToDate')}</span>
            </div>
            <div className="sep" />
            <button className="btn btn-line" style={{ width: '100%', marginTop: 8 }} onClick={checkUpdates}>
              {t('updCheck')}
            </button>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, lineHeight: 1.8, marginTop: 8, paddingBottom: 8 }}>
              {t('updNoNative')}
            </div>
          </div>
        </>
      );
    }

    case 'addons':
      return (
        <>
          <SheetHeader title={t('extensT')} />
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 10 }}>
            {t('extensD')}
          </div>
          <div className="card" style={{ padding: '4px 14px' }}>
            <div className="kv">
              <span className="k">{t('ver')}</span>
              <span className="v num">{(updater.manifest && updater.manifest.version) || '3.0.0'}</span>
            </div>
            <div className="kv">
              <span className="k">{t('modT')}</span>
              <span className="v num">1</span>
            </div>
            <div className="kv">
              <span className="k">sample/hello</span>
              <span className="v num">1.0.0</span>
            </div>
          </div>
        </>
      );

    case 'qrSend':
      return <QrSvgSheet title={t('qrSend')} data={sheet.payload} hint={t('qrHint')} />;

    case 'qrStmt': {
      const c = getCust(dd, sheet.cid);
      return (
        <QrSvgSheet
          title={`${t('qrStmt')} — ${c ? c.name : ''}`}
          data={sheet.text}
          hint={t('qrStmtHint')}
          extraText={sheet.text}
        />
      );
    }

    case 'qrRecv':
      return <QrRecvSheet />;

    case 'contactsInfo':
      return (
        <>
          <SheetHeader title={t('contactsT')} />
          <div className="card" style={{ padding: '16px 13px' }}>
            <div className="row" style={{ color: 'var(--soft)' }}>
              <Icon name="shield" size={17} />
              <span style={{ fontSize: 12.5 }}>{t('contactsAppOnly')}</span>
            </div>
          </div>
        </>
      );

    case 'dupCustomers': {
      const sims = sheet.sims;
      if (!sims.length) return null;
      return (
        <>
          <h3>
            {t('dupT')}
            {sims.length > 1 ? (
              <>
                {' '}
                — <span className="num">{sims.length}</span>
              </>
            ) : null}
          </h3>
          <div style={{ maxHeight: 'min(44vh, 320px)', overflow: 'auto', marginTop: 8, padding: '2px 2px 6px' }}>
            {sims.slice(0, 12).map(({ c: dup }: { c: Customer }) => (
              <button
                key={dup.id}
                className="card litem"
                style={{ width: '100%', textAlign: 'start', marginBottom: 8 }}
                onClick={() => {
                  closeSheet();
                  resetStack([{ s: 'profile', p: { id: dup.id } }]);
                }}
              >
                <Avatar name={dup.name} size={42} cid={dup.id} />
                <div className="sp">
                  <b>{dup.name}</b>
                  {dup.phone ? (
                    <div className="muted num" style={{ direction: 'ltr' }}>
                      {dup.phone}
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 12 }}>
                      —
                    </div>
                  )}
                  <div className="muted">
                    {t('remaining')}: <b className="num">{fmt(custOpen(ix, dup.id), mu)}</b> {curAcc.cur}
                  </div>
                </div>
                <Icon name="fwd" size={17} />
              </button>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            {t('dupQ')}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
              {t('cancel')}
            </button>
            <button
              className="btn btn-navy"
              style={{ flex: 1.3 }}
              onClick={() => {
                closeSheet();
                saveCustomer(true);
              }}
            >
              {t('dupNew')}
            </button>
          </div>
        </>
      );
    }

    case 'pinSetup':
      return <PinSetupSheet />;

    case 'confirmReset':
      return (
        <>
          <SheetHeader title={t('reset')} />
          <div className="muted" style={{ lineHeight: 1.8, marginBottom: 14 }}>
            {t('resetQ')}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
              {t('cancel')}
            </button>
            <button className="btn btn-red" style={{ flex: 1 }} onClick={resetAll}>
              {t('del')}
            </button>
          </div>
        </>
      );

    case 'confirmTrashPurge':
      return (
        <>
          <SheetHeader title={t('emptyTrash')} />
          <div className="muted" style={{ lineHeight: 1.8, marginBottom: 14 }}>
            {t('emptyTrashQ')}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-line" style={{ flex: 1 }} onClick={closeSheet}>
              {t('cancel')}
            </button>
            <button className="btn btn-red" style={{ flex: 1 }} onClick={trashPurge}>
              {t('emptyTrash')}
            </button>
          </div>
        </>
      );

    case 'repCustPicker': {
      const cs = (dd.customers || []).filter((c: Customer) => !c.archived);
      return (
        <>
          <SheetHeader title={t('cust')} />
          <button
            className="srow"
            onClick={() => {
              setUi((prev: any) => ({ ...prev, rp: { ...prev.rp, cust: null } }));
              closeSheet();
            }}
          >
            <span className="sic2" style={{ background: 'var(--navy-bg)', color: 'var(--navy)' }}>
              <Icon name="users" size={20} />
            </span>
            <span className="sp" style={{ textAlign: 'start' }}>
              <span className="t">{t('repCustAll')}</span>
            </span>
            {!ui.rp.cust && <Icon name="checkc" size={18} />}
          </button>
          {cs.map((c: Customer) => (
            <button
              key={c.id}
              className="srow"
              onClick={() => {
                setUi((prev: any) => ({ ...prev, rp: { ...prev.rp, cust: c.id } }));
                closeSheet();
              }}
            >
              <span className="sic2">
                <Avatar name={c.name} size={26} cid={c.id} />
              </span>
              <span className="sp" style={{ textAlign: 'start' }}>
                <span className="t">{c.name}</span>
              </span>
              {ui.rp.cust === c.id && <Icon name="checkc" size={18} />}
            </button>
          ))}
        </>
      );
    }

    case 'quickActions': {
      const c = getCust(dd, sheet.cid);
      if (!c) return null;
      const open = custOpen(ix, c.id);
      const vh = String(t('voiceHint')).split('.')[0];
      return (
        <>
          <div className="row" style={{ marginBottom: 14, gap: 10 }}>
            <div className="mcust-pill">
              <Avatar name={c.name} size={42} cid={c.id} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t('remaining')}: <b className="num">{fmt(open, mu)}</b> {curAcc.cur}
                </div>
              </div>
            </div>
            <button className="hbtn" onClick={closeSheet} aria-label={t('close')}>
              <Icon name="x" size={17} />
            </button>
          </div>

          <div className="mgroup">
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                startRec('debt', c.id);
              }}
            >
              <span className="mic red">
                <Icon name="mic" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('recDebt')}</span>
                <span className="md">{vh}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button className="mrow" onClick={() => openSheet({ type: 'quickPay', cid: c.id })}>
              <span className="mic green">
                <Icon name="coins" size={19} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('quickPay')}</span>
                <span className="md">{t('quickPayDesc')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
          </div>

          <div className="mgroup">
            <button
              className="mrow"
              onClick={() => {
                togglePin(c.id);
                closeSheet();
              }}
            >
              <span className={`mic ${c.pinned ? 'amber' : ''}`}>
                <Icon name={c.pinned ? 'pinf' : 'pin'} size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{c.pinned ? t('unpinAct') : t('pinAct')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            <button className="mrow" onClick={() => openSheet({ type: 'openingBalance', cid: c.id })}>
              <span className="mic amber">
                <Icon name="hist" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('opening')}</span>
                <span className="md">{t('openingD')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
            {c.phone && (
              <a
                className="mrow"
                style={{ textDecoration: 'none', color: 'inherit' }}
                href={`tel:${(c.phone || '').replace(/[^0-9+]/g, '')}`}
              >
                <span className="mic green">
                  <Icon name="phone" size={18} />
                </span>
                <span className="mtxt">
                  <span className="mt">{t('callC')}</span>
                  <span className="md num">{c.phone}</span>
                </span>
                <Icon name="fwd" size={16} className="mchev" />
              </a>
            )}
            <button
              className="mrow"
              onClick={() => {
                closeSheet();
                go('profile', { id: c.id });
              }}
            >
              <span className="mic">
                <Icon name="user" size={18} />
              </span>
              <span className="mtxt">
                <span className="mt">{t('openAcc2')}</span>
              </span>
              <Icon name="fwd" size={16} className="mchev" />
            </button>
          </div>
        </>
      );
    }

    case 'quickPay':
      return <QuickPaySheet cid={sheet.cid} />;

    default:
      return null;
  }
};
