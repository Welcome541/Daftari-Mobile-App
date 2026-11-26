import React, { useRef } from 'react';
import { Icon } from '../components/Icon';
import { NotifButton } from '../components/HeaderBar';
import { useApp } from '../context/AppContext';
import { haptic, playSound } from '../core/feedback';
import { cName, COUNTRIES } from '../core/i18n';
import { DENSITIES, SCALES } from '../core/appearance';

export const SettingsScreen: React.FC = () => {
  const {
    db,
    dd,
    curAcc,
    sec,
    darkOn,
    ui,
    setUi,
    appearance,
    updater,
    t,
    go,
    openSheet,
    updateSec,
    setCur,
    setLang,
    lockNow,
    disableLock,
    addFp,
    fpDel,
    downloadBackup,
    restoreBackupFile,
    exportAll,
    toastMsg,
  } = useApp();

  const bkFileRef = useRef<HTMLInputElement>(null);
  const projFileRef = useRef<HTMLInputElement>(null);

  if (!db) return null;

  const stCol = sec.enabled ? 'var(--green)' : 'var(--muted)';
  const scaleLabel = t(SCALES.find((x) => Math.abs(x.v - appearance.scale) < 0.03)?.k || 'uiScaleM');
  const densityLabel = t(DENSITIES.find((x) => Math.abs(x.v - appearance.density) < 0.03)?.k || 'uiDensityN');

  const kvRow = (
    bg: string,
    col: string,
    icon: Parameters<typeof Icon>[0]['name'],
    label: React.ReactNode,
    right: React.ReactNode,
    onClick?: () => void
  ) => (
    <div className="kv" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      <span
        className="kic"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: bg,
          color: col,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={17} />
      </span>
      <span className="k" style={{ marginInlineStart: 8 }}>
        {label}
      </span>
      <span className="v">{right}</span>
    </div>
  );

  const handleProjPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.html?$/i.test(f.name)) {
      toastMsg(t('projZipNo'));
    } else {
      toastMsg(t('updNoNative'));
    }
    e.target.value = '';
  };

  return (
    <>
      <div className="hdr">
        <span style={{ width: 42 }} />
        <div className="sp" style={{ textAlign: 'center' }}>
          <h1>{t('settings')}</h1>
        </div>
        <NotifButton />
      </div>

      <div className="pad">
        <div className="lb">{t('account')}</div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            <span
              className="av"
              style={{
                width: 44,
                height: 44,
                background: curAcc.type === 'grocery' ? 'var(--green-bg)' : 'var(--navy-bg)',
                color: curAcc.type === 'grocery' ? 'var(--green)' : 'var(--navy)',
              }}
            >
              <Icon name={curAcc.type === 'grocery' ? 'store' : 'user'} size={20} />
            </span>
            <div className="sp">
              <div style={{ fontWeight: 800 }}>{curAcc.name}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {t(curAcc.type === 'grocery' ? 'grocery' : 'personal')} ·{' '}
                {cName(curAcc.cur) ? `${cName(curAcc.cur)} · ` : ''}
                {curAcc.cur}
              </div>
            </div>
            <button
              className="btn btn-line"
              style={{ minWidth: 0, padding: '8px 14px', fontSize: 13 }}
              onClick={() => openSheet({ type: 'accountSwitcher' })}
            >
              <Icon name="gear" size={16} />
              {t('switchAcc')}
            </button>
          </div>
        </div>

        <div className="lb">{t('prefs')}</div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {kvRow(
            'var(--green-bg)',
            'var(--green)',
            'coins',
            t('country'),
            <select
              className="selctl"
              aria-label={t('country')}
              value={cName(curAcc.cur) ? curAcc.cur : curAcc.cur}
              onChange={(e) => {
                if (e.target.value === '__c') {
                  openSheet({ type: 'customCur' });
                } else {
                  setCur(e.target.value);
                }
              }}
            >
              {COUNTRIES.map((x) => (
                <option key={x[1]} value={x[1]}>
                  {x[0]} · {x[1]}
                </option>
              ))}
              {!cName(curAcc.cur) && <option value={curAcc.cur}>{curAcc.cur}</option>}
              <option value="__c">✎ {t('curCustom')}</option>
            </select>
          )}
          <div className="sep" />
          {kvRow(
            'var(--navy-bg)',
            'var(--navy)',
            'tag',
            t('lang'),
            <div className="seg" style={{ width: 120, padding: 2 }}>
              <button
                className={db.lang === 'ar' ? 'on' : ''}
                onClick={() => {
                  haptic('tap', sec);
                  setLang('ar');
                }}
              >
                العربية
              </button>
              <button
                className={db.lang === 'en' ? 'on' : ''}
                onClick={() => {
                  haptic('tap', sec);
                  setLang('en');
                }}
              >
                EN
              </button>
            </div>
          )}
          <div className="sep" />
          {kvRow(
            darkOn ? 'var(--navy-bg)' : 'var(--amber-bg)',
            darkOn ? 'var(--navy)' : 'var(--amber)',
            darkOn ? 'moon' : 'sun',
            t('theme'),
            <div className="dmsw">
              <span className="soft" style={{ fontWeight: 800, fontSize: 12, minWidth: 38, textAlign: 'center' }}>
                {sec.darkAuto ? t('darkAuto') : darkOn ? t('darkNight') : t('darkDay')}
              </span>
              <div
                className={`sw2 ${sec.dark ? 'on' : ''}`}
                role="switch"
                aria-checked={sec.dark ? 'true' : 'false'}
                aria-label={t('theme')}
                onClick={() => {
                  haptic('tap', sec);
                  updateSec((d) => {
                    d.dark = !d.dark;
                    d.darkAuto = false;
                  });
                }}
              />
              <button
                className={`autochip ${sec.darkAuto ? 'on' : ''}`}
                onClick={() => {
                  haptic('tap', sec);
                  updateSec((d) => {
                    d.darkAuto = !d.darkAuto;
                  });
                }}
              >
                {t('darkAuto')}
              </button>
            </div>
          )}
        </div>

        <div className="lb">{t('sound')}</div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {kvRow(
            sec.sound ? 'var(--green-bg)' : 'var(--line2)',
            sec.sound ? 'var(--green)' : 'var(--muted)',
            sec.sound ? 'bell' : 'belloff',
            t('sound'),
            <div
              className={`sw2 ${sec.sound ? 'on' : ''}`}
              role="switch"
              aria-checked={sec.sound ? 'true' : 'false'}
              aria-label={t('sound')}
              onClick={() => {
                const nextSound = !sec.sound;
                haptic('tap', sec);
                updateSec((d) => {
                  d.sound = nextSound;
                });
                if (nextSound) playSound('success', { sound: true });
              }}
            />
          )}
          <div className="sep" />
          {kvRow(
            sec.vib ? 'var(--green-bg)' : 'var(--line2)',
            sec.vib ? 'var(--green)' : 'var(--muted)',
            sec.vib ? 'vibrate' : 'viboff',
            t('vib'),
            <div
              className={`sw2 ${sec.vib ? 'on' : ''}`}
              role="switch"
              aria-checked={sec.vib ? 'true' : 'false'}
              aria-label={t('vib')}
              onClick={() => {
                const nextVib = !sec.vib;
                updateSec((d) => {
                  d.vib = nextVib;
                });
                if (nextVib) haptic('select', { vib: true });
              }}
            />
          )}
        </div>

        <div className="lb">{t('trashT')}</div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {kvRow(
            'var(--red-bg)',
            'var(--red)',
            'trash',
            t('trashT'),
            <>
              <span
                className="num"
                style={{
                  background: 'var(--red)',
                  color: '#fff',
                  borderRadius: 999,
                  fontSize: 10.5,
                  minWidth: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                }}
              >
                {(dd.trash || []).length}
              </span>{' '}
              <Icon name="fwd" size={16} />
            </>,
            () => go('trash', {})
          )}
        </div>

        <div className="lb">{t('security')}</div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {kvRow(
            sec.enabled ? 'var(--green-bg)' : 'var(--line2)',
            sec.enabled ? 'var(--green)' : 'var(--muted)',
            sec.enabled ? 'lock' : 'unlock',
            t('pinLock'),
            <>
              <span style={{ fontWeight: 800, color: stCol }}>{t(sec.enabled ? 'on' : 'off')}</span>
              <button
                className="hbtn"
                aria-label={t('setPin')}
                onClick={() => openSheet({ type: 'pinSetup' })}
              >
                <Icon name="shield" size={17} />
              </button>
            </>
          )}

          {sec.enabled && (
            <>
              <div className="sep" />
              {kvRow(
                sec.fps && sec.fps.length ? 'var(--green-bg)' : 'var(--line2)',
                sec.fps && sec.fps.length ? 'var(--green)' : 'var(--muted)',
                'fp',
                `${t('useFinger')} (${sec.fps ? sec.fps.length : 0})`,
                <button className="hbtn" onClick={addFp} style={{ color: 'var(--navy)' }}>
                  {t('fpAdd')}
                </button>
              )}
              {(sec.fps || []).map((_, i) => (
                <React.Fragment key={i}>
                  <div className="sep" />
                  <div className="kv">
                    <span
                      className="kic"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'var(--navy-bg)',
                        color: 'var(--navy)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="fp" size={16} />
                    </span>
                    <span className="k" style={{ marginInlineStart: 8 }}>
                      {t('fpN')} {i + 1}
                    </span>
                    <span className="v">
                      <button className="hbtn" style={{ color: 'var(--red)' }} onClick={() => fpDel(i)}>
                        <Icon name="x" size={15} />
                      </button>
                    </span>
                  </div>
                </React.Fragment>
              ))}
              <div className="sep" />
              {kvRow(
                'var(--red-bg)',
                'var(--red)',
                'clock',
                t('autoLock'),
                <select
                  className="inp"
                  style={{ width: 130, padding: '7px 10px' }}
                  value={sec.autoMin}
                  onChange={(e) =>
                    updateSec((d) => {
                      d.autoMin = Number(e.target.value);
                    })
                  }
                >
                  {[1, 5, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
              <div className="sep" />
              {kvRow('var(--red-bg)', 'var(--red)', 'lock', t('lockNow'), <Icon name="fwd" size={16} />, lockNow)}
              <div className="sep" />
              {kvRow('var(--red-bg)', 'var(--red)', 'x', t('turnOffPin'), <Icon name="fwd" size={16} />, disableLock)}
            </>
          )}
        </div>

        <div className="lb">{t('dataSec')}</div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {kvRow('var(--green-bg)', 'var(--green)', 'down', t('backupT'), <Icon name="fwd" size={16} />, downloadBackup)}
          <div className="sep" />
          {kvRow(
            'var(--navy-bg)',
            'var(--navy)',
            'up',
            t('restoreT'),
            <Icon name="fwd" size={16} />,
            () => bkFileRef.current?.click()
          )}
          <input
            ref={bkFileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restoreBackupFile(f);
              e.target.value = '';
            }}
          />
          <div className="sep" />
          {kvRow('var(--navy-bg)', 'var(--navy)', 'excel', t('exportAll'), <Icon name="fwd" size={16} />, exportAll)}
          <div className="sep" />
          {kvRow(
            'var(--amber-bg)',
            'var(--amber)',
            'zap',
            t('demoT'),
            <Icon name="fwd" size={16} />,
            () => openSheet({ type: 'demoData' })
          )}
          <div className="sep" />
          {kvRow(
            'var(--red-bg)',
            'var(--red)',
            'trash',
            t('reset'),
            <Icon name="fwd" size={16} />,
            () => openSheet({ type: 'confirmReset' })
          )}
        </div>

        <div className="card" style={{ marginTop: 16, padding: '2px 16px' }}>
          <div
            className="kv"
            style={{ cursor: 'pointer' }}
            onClick={() => setUi((prev) => ({ ...prev, voskOpen: !prev.voskOpen }))}
          >
            <span
              className="kic"
              style={{
                background: sec.vosk ? 'var(--green-bg)' : 'var(--line2)',
                color: sec.vosk ? 'var(--green)' : 'var(--muted)',
              }}
            >
              <Icon name="mic" size={17} />
            </span>
            <span className="k">{t('voskOpt')}</span>
            <span className="v" style={{ fontWeight: 800, color: 'var(--soft)' }}>
              {t(sec.vosk ? 'on' : 'off')}
              {ui.voskOpen ? ' ▾' : ''}
            </span>
          </div>

          {ui.voskOpen && (
            <>
              <div className="sep" />
              <div className="muted" style={{ padding: '10px 2px', fontSize: 12, lineHeight: 1.9, whiteSpace: 'pre-line' }}>
                {t('voskHelp')}
              </div>
              <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
                <button
                  className="btn btn-line"
                  style={{ flex: 1 }}
                  onClick={() =>
                    updateSec((d) => {
                      d.vosk = !d.vosk;
                    })
                  }
                >
                  {sec.vosk ? t('voskOff') : t('voskOn')}
                </button>
              </div>
            </>
          )}

          <div className="sep" />
          <div className="kv" style={{ cursor: 'pointer' }} onClick={() => openSheet({ type: 'extVoice' })}>
            <span className="kic" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
              <Icon name="mic" size={17} />
            </span>
            <span className="k">{t('extT')}</span>
            <span className="v" style={{ color: 'var(--soft)', fontWeight: 700, fontSize: 12 }}>
              {t('extGo')}
            </span>
          </div>

          <div className="sep" />
          <div className="kv" style={{ cursor: 'pointer' }} onClick={() => projFileRef.current?.click()}>
            <span className="kic" style={{ background: 'var(--navy-bg)', color: 'var(--navy)' }}>
              <Icon name="up" size={17} />
            </span>
            <span className="k">{t('projPull')}</span>
            <span className="v" style={{ color: 'var(--soft)', fontWeight: 700, fontSize: 12 }}>
              {t('projGo')}
            </span>
          </div>
          <input
            ref={projFileRef}
            type="file"
            accept=".html,.htm,.zip"
            style={{ display: 'none' }}
            onChange={handleProjPickFile}
          />

          <div className="muted" style={{ textAlign: 'center', fontSize: 11, padding: '10px 16px 0', lineHeight: 1.9 }}>
            {t('locHint')}
          </div>

          <div className="sep" />
          <div className="kv" style={{ cursor: 'pointer' }} onClick={() => openSheet({ type: 'appearance' })}>
            <span className="kic" style={{ background: 'var(--navy-bg)', color: 'var(--navy)' }}>
              <Icon name="sliders" size={17} />
            </span>
            <span className="k" style={{ marginInlineStart: 8 }}>
              {t('appearT')}
            </span>
            <span className="v" style={{ color: 'var(--soft)', fontWeight: 700, fontSize: 12 }}>
              {scaleLabel} · {densityLabel}
            </span>
          </div>

          <div className="sep" />
          <div className="kv" style={{ cursor: 'pointer' }} onClick={() => openSheet({ type: 'updater' })}>
            <span className="kic" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
              <Icon name="down" size={17} />
            </span>
            <span className="k" style={{ marginInlineStart: 8 }}>
              {t('updT')}
            </span>
            <span className="v num" style={{ color: 'var(--soft)', fontWeight: 700, fontSize: 12 }}>
              {(updater.manifest && updater.manifest.version) || '3.0.0'}
            </span>
          </div>

          <div className="sep" />
          <div className="kv" style={{ cursor: 'pointer' }} onClick={() => openSheet({ type: 'addons' })}>
            <span className="kic" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
              <Icon name="zap" size={17} />
            </span>
            <span className="k" style={{ marginInlineStart: 8 }}>
              {t('extensT')}
            </span>
            <span className="v" style={{ color: 'var(--soft)', fontWeight: 700, fontSize: 12 }}>
              1 {t('modLoaded')}
            </span>
          </div>

          <div className="muted" style={{ textAlign: 'center', fontSize: 11, padding: '16px 0 6px' }}>
            {t('ver')} <span className="num">{(updater.manifest && updater.manifest.version) || '3.0.0'}</span>
          </div>
        </div>
      </div>
    </>
  );
};
