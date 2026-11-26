import React, { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { useApp } from '../context/AppContext';
import { getCust } from '../core/ledger';

export const NewCustomerScreen: React.FC<{ edit?: string }> = ({ edit }) => {
  const { db, dd, ui, setUi, t, back, openSheet, openContacts, saveCustomer } = useApp();

  useEffect(() => {
    if (edit && ui.nc.edit !== edit) {
      const ed = getCust(dd, edit);
      if (ed) {
        setUi((prev) => ({
          ...prev,
          nc: {
            name: ed.name,
            phone: ed.phone || '',
            photo: ed.photo || null,
            edit: ed.id,
            forceDup: false,
          },
        }));
      }
    }
  }, [edit, dd, ui.nc.edit, setUi]);

  if (!db) return null;
  const ed = edit ? getCust(dd, edit) : null;
  const nm = ui.nc.name || '';
  const initials = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('');

  return (
    <>
      <HeaderBar title={ed ? t('editC') : t('addC')} onBack={back} />
      <div className="pad">
        <div className="card" style={{ padding: '20px 17px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            className="av"
            style={{
              width: 92,
              height: 92,
              fontSize: 28,
              padding: 0,
              cursor: 'pointer',
              background: ui.nc.photo ? 'none' : nm ? 'var(--navy)' : '#d9d2c6',
              color: nm ? '#fff' : 'var(--navy)',
            }}
            onClick={() => openSheet({ type: 'photoPicker', target: 'nc' })}
            aria-label={t('photoT')}
          >
            {ui.nc.photo ? (
              <img
                src={ui.nc.photo}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : nm ? (
              initials(nm)
            ) : (
              <Icon name="user" size={32} />
            )}
          </span>

          <div style={{ width: '100%' }}>
            <label className="lb">{t('nameReq')}</label>
            <input
              className="inp"
              value={nm}
              onChange={(e) => setUi((prev) => ({ ...prev, nc: { ...prev.nc, name: e.target.value } }))}
              placeholder={db.lang === 'ar' ? 'مثال: حسن القحطاني' : 'e.g. Hasan'}
            />

            <label className="lb">{t('phone')}</label>
            <input
              className="inp num"
              value={ui.nc.phone || ''}
              onChange={(e) => setUi((prev) => ({ ...prev, nc: { ...prev.nc, phone: e.target.value } }))}
              inputMode="tel"
              placeholder="05x xxx xxxx"
            />

            <button className="btn btn-line" style={{ marginTop: 13 }} onClick={openContacts}>
              <Icon name="contact" size={18} />
              {t('fromContacts')}
            </button>

            <div className="muted" style={{ textAlign: 'center', marginTop: 13 }}>
              <Icon name="lock" size={12} /> {t('privacyC')}
            </div>
          </div>
        </div>
      </div>

      <div className="bottombar">
        <button className="btn btn-navy" onClick={() => saveCustomer(false)}>
          <Icon name="save" size={18} />
          {t('saveC')}
        </button>
      </div>
    </>
  );
};
