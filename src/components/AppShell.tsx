import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { Icon } from './Icon';
import { LongPressButton } from './LongPressButton';
import { BottomSheet } from './BottomSheet';
import { SheetsRenderer } from './SheetsRenderer';
import { Toast } from './Toast';
import { PrintView } from './PrintView';
import { filteredCustomers, filteredTx } from '../core/queries';
import { copyText } from '../core/exports';
import { HomeScreen } from '../screens/HomeScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CustomerProfileScreen } from '../screens/CustomerProfileScreen';
import { InvoiceScreen } from '../screens/InvoiceScreen';
import { VoiceRecScreen } from '../screens/VoiceRecScreen';
import { WizardScreen } from '../screens/WizardScreen';
import { NewCustomerScreen } from '../screens/NewCustomerScreen';
import { TrashScreen } from '../screens/TrashScreen';
import { LockScreen } from '../screens/LockScreen';

const TABS = ['home', 'customers', 'reports', 'settings'] as const;
const SCREEN_ORDER = [
  'home',
  'customers',
  'reports',
  'settings',
  'profile',
  'invoice',
  'voice',
  'rec',
  'wiz',
  'repb',
  'newcust',
  'trash',
  'lock',
];
const VIS_SEL = 'button,[onclick],a,input,select,textarea,[role="button"]';

export const AppShell: React.FC = () => {
  const {
    db,
    dd,
    ix,
    sec,
    locked,
    busy,
    curScr,
    ui,
    setUi,
    sheet,
    t,
    tab,
    go,
    toastMsg,
    selExit,
    cselExit,
  } = useApp();

  const appRef = useRef<HTMLDivElement>(null);
  const ptrYRef = useRef<number | null>(null);
  const lastYRef = useRef(0);
  const stTickRef = useRef(false);
  const stLockRef = useRef(false);

  const [ptrOn, setPtrOn] = useState(false);
  const [ptrText, setPtrText] = useState('');
  const [scrollTopVisible, setScrollTopVisible] = useState(false);

  const selMode = !!((ui.sel && ui.sel.on) || (ui.csel && ui.csel.on));
  const isTab = !locked && (TABS as readonly string[]).includes(curScr.s);

  // Scroll to top on screen navigation unless staying in selection mode
  const prevScrRef = useRef(curScr);
  useEffect(() => {
    const prev = prevScrRef.current;
    prevScrRef.current = curScr;
    if (prev !== curScr && !selMode && appRef.current) {
      appRef.current.scrollTop = 0;
      setScrollTopVisible(false);
    }
  }, [curScr, selMode]);

  // 3-second hold location-code diagnostic helper
  const locStateRef = useRef({
    curScr,
    sheetOpen: !!sheet,
    ui,
    t,
    toastMsg,
    selExit,
    cselExit,
    vib: sec.vib,
  });
  locStateRef.current = {
    curScr,
    sheetOpen: !!sheet,
    ui,
    t,
    toastMsg,
    selExit,
    cselExit,
    vib: sec.vib,
  };

  useEffect(() => {
    let locT: number | null = null;
    let locX = 0;
    let locY = 0;

    const locCodeFor = (x: number, y: number) => {
      const st = locStateRef.current;
      let n = SCREEN_ORDER.indexOf(st.curScr.s) + 1;
      if (n <= 0) n = 1;
      if (st.sheetOpen) n += 100;
      const cx = Math.max(0, Math.min(99, Math.round((x / (window.innerWidth || 390)) * 100)));
      const cy = Math.max(0, Math.min(99, Math.round((y / (window.innerHeight || 844)) * 100)));
      let e = 0;
      try {
        const el = document.elementFromPoint(x, y);
        const c = el && el.closest ? el.closest(VIS_SEL) : null;
        if (c) e = Array.from(document.querySelectorAll(VIS_SEL)).indexOf(c) + 1;
      } catch {
        // ignore
      }
      return `${n}-${cx}-${cy}-${e}`;
    };

    const locDown = (x: number, y: number) => {
      locX = x;
      locY = y;
      if (locT) clearTimeout(locT);
      locT = window.setTimeout(() => {
        locT = null;
        const st = locStateRef.current;
        if (st.ui.rec || st.ui.sel.on || st.ui.csel.on) return;
        const code = locCodeFor(locX, locY);
        const fn = st.t('locCopied');
        const msg = typeof fn === 'function' ? fn(code) : code;
        copyText(code).then(() => st.toastMsg(msg));
        haptic('longPress', { vib: st.vib });
      }, 3000);
    };

    const locMove = (x: number, y: number) => {
      if (!locT) return;
      if (Math.abs(x - locX) + Math.abs(y - locY) > 12) {
        clearTimeout(locT);
        locT = null;
      }
    };

    const locUp = () => {
      if (locT) clearTimeout(locT);
      locT = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      const p = e.touches[0];
      if (p) locDown(p.clientX, p.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const p = e.touches[0];
      if (p) locMove(p.clientX, p.clientY);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      locDown(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      locMove(e.clientX, e.clientY);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', locUp, { passive: true });
    document.addEventListener('touchcancel', locUp, { passive: true });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove as EventListener);
    document.addEventListener('pointerup', locUp);
    document.addEventListener('pointercancel', locUp);

    return () => {
      locUp();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', locUp);
      document.removeEventListener('touchcancel', locUp);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove as EventListener);
      document.removeEventListener('pointerup', locUp);
      document.removeEventListener('pointercancel', locUp);
    };
  }, []);

  // Scroll-to-top + infinite scroll
  const handleAppScroll = useCallback(() => {
    if (stTickRef.current) return;
    stTickRef.current = true;
    requestAnimationFrame(() => {
      stTickRef.current = false;
      const sc = appRef.current;
      if (!sc) return;
      const y = sc.scrollTop;
      const sh = sc.scrollHeight;
      const ch = sc.clientHeight;
      const dy = y - lastYRef.current;

      if (y < 320) {
        setScrollTopVisible(false);
      } else if (y > 520) {
        if (dy < -8) setScrollTopVisible(true);
        else if (dy > 8) setScrollTopVisible(false);
      }

      if (!stLockRef.current && db && y + ch >= sh - 300) {
        if (curScr.s === 'customers' && !ui.arch) {
          const total = filteredCustomers(dd, ix, ui.f, ui.cq).length;
          if (total > (ui.cmax || 60)) {
            stLockRef.current = true;
            setUi((prev) => ({ ...prev, cmax: (prev.cmax || 60) + 60 }));
            window.setTimeout(() => {
              stLockRef.current = false;
            }, 260);
          }
        } else if (curScr.s === 'home') {
          const { items, fullCount } = filteredTx(db, dd, ui.tf, ui.tq, ui.txLimit || 60);
          if (fullCount > items.length) {
            stLockRef.current = true;
            setUi((prev) => ({ ...prev, txLimit: (prev.txLimit || 60) + 60 }));
            window.setTimeout(() => {
              stLockRef.current = false;
            }, 260);
          }
        }
      }

      lastYRef.current = y;
    });
  }, [curScr.s, db, dd, ix, setUi, ui.arch, ui.cmax, ui.cq, ui.f, ui.tf, ui.tq, ui.txLimit]);

  const scrollToTop = () => {
    appRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    haptic('tap', sec);
  };

  const handleTabClick = (target: typeof TABS[number]) => {
    haptic('tap', sec);
    if (curScr.s === target) {
      scrollToTop();
    } else {
      tab(target);
    }
  };

  // Pull-to-refresh on Home screen
  const handlePhoneTouchStart = (e: React.TouchEvent) => {
    const y = appRef.current ? appRef.current.scrollTop : window.scrollY;
    if (y <= 2 && curScr.s === 'home' && !locked) {
      ptrYRef.current = e.touches[0].clientY;
    }
  };

  const handlePhoneTouchMove = (e: React.TouchEvent) => {
    if (ptrYRef.current === null) return;
    const dy = e.touches[0].clientY - ptrYRef.current;
    setPtrText(t('pull'));
    setPtrOn(dy > 70);
  };

  const handlePhoneTouchEnd = () => {
    if (ptrOn) {
      haptic('select', sec);
      setPtrText(t('refreshed'));
      window.setTimeout(() => setPtrOn(false), 700);
      setUi((prev) => ({ ...prev }));
    } else {
      window.setTimeout(() => setPtrOn(false), 900);
    }
    ptrYRef.current = null;
  };

  const renderScreen = () => {
    if (!db) return null;
    if (locked) return <LockScreen />;
    switch (curScr.s) {
      case 'home':
        return <HomeScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'repb':
        return <ReportsScreen isSub />;
      case 'settings':
        return <SettingsScreen />;
      case 'profile':
        return <CustomerProfileScreen id={curScr.p?.id || ''} focus={curScr.p?.focus} />;
      case 'invoice':
        return <InvoiceScreen id={curScr.p?.id || ''} />;
      case 'rec':
      case 'voice':
        return <VoiceRecScreen kind={curScr.p?.kind} />;
      case 'wiz':
        return <WizardScreen />;
      case 'newcust':
        return <NewCustomerScreen edit={curScr.p?.edit} />;
      case 'trash':
        return <TrashScreen />;
      case 'lock':
        return <LockScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <>
      <div
        id="phone"
        onTouchStart={handlePhoneTouchStart}
        onTouchMove={handlePhoneTouchMove}
        onTouchEnd={handlePhoneTouchEnd}
      >
        <div className="sbar">
          <span>9:41</span>
          <span className="sic">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
              <rect x="0" y="7" width="3" height="5" rx="1" />
              <rect x="4.5" y="5" width="3" height="7" rx="1" />
              <rect x="9" y="2.5" width="3" height="9.5" rx="1" />
              <rect x="13.5" y="0" width="3" height="12" rx="1" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 4.2a10 10 0 0 1 14 0" />
              <path d="M3.5 6.8a6.5 6.5 0 0 1 9 0" />
              <path d="M6 9.3a3 3 0 0 1 4 0" />
              <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity=".4" />
              <rect x="2" y="2" width="18" height="8" rx="1.6" fill="currentColor" />
              <path d="M23 4v4a4 4 0 0 0 0-4Z" fill="currentColor" opacity=".4" />
            </svg>
          </span>
        </div>

        <div className={`ptr${ptrOn ? ' on' : ''}`} id="ptr">
          <span className="row" style={{ gap: 8 }}>
            <svg
              className="ic"
              aria-hidden="true"
              focusable="false"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            <span id="ptrT">{ptrText}</span>
          </span>
        </div>

        <div
          id="app"
          ref={appRef}
          role="main"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          onScroll={handleAppScroll}
        >
          {renderScreen()}
        </div>

        <button
          id="scrollTopBtn"
          className={scrollTopVisible ? 'show' : 'hide'}
          aria-label={t('back')}
          onClick={scrollToTop}
        >
          <span className="icwrap">
            <Icon name="toTop" size={20} />
          </span>
        </button>

        <div id="fabAdd" className="hide" />

        {isTab && !selMode && curScr.s === 'home' && (
          <div id="actionrow">
            <LongPressButton kind="debt" cls="btn-red" icon="receipt" label={t('newDebt')} />
            <LongPressButton kind="pay" cls="btn-green" icon="coins" label={t('pay')} />
          </div>
        )}

        <nav id="tabbar" style={{ display: isTab ? 'grid' : 'none' }}>
          <button
            className={curScr.s === 'home' ? 'on' : ''}
            aria-current={curScr.s === 'home' ? 'true' : 'false'}
            onClick={() => handleTabClick('home')}
          >
            <span className="tbind">
              <Icon name="home" size={22} />
            </span>
            <span className="tblb">{t('home')}</span>
          </button>

          <button
            className={curScr.s === 'customers' ? 'on' : ''}
            aria-current={curScr.s === 'customers' ? 'true' : 'false'}
            onClick={() => handleTabClick('customers')}
          >
            <span className="tbind">
              <Icon name="users" size={22} />
            </span>
            <span className="tblb">{t('customers')}</span>
          </button>

          <button
            className="tabplus"
            aria-label={t('addC')}
            onClick={() => {
              haptic('tap', sec);
              setUi((prev) => ({
                ...prev,
                nc: { name: '', phone: '', limit: '', photo: null, edit: null, forceDup: false },
              }));
              go('newcust', {});
            }}
          >
            <Icon name="userplus" size={22} />
          </button>

          <button
            className={curScr.s === 'reports' ? 'on' : ''}
            aria-current={curScr.s === 'reports' ? 'true' : 'false'}
            onClick={() => handleTabClick('reports')}
          >
            <span className="tbind">
              <Icon name="pie" size={22} />
            </span>
            <span className="tblb">{t('reports')}</span>
          </button>

          <button
            className={curScr.s === 'settings' ? 'on' : ''}
            aria-current={curScr.s === 'settings' ? 'true' : 'false'}
            onClick={() => handleTabClick('settings')}
          >
            <span className="tbind">
              <Icon name="gear" size={22} />
            </span>
            <span className="tblb">{t('settings')}</span>
          </button>
        </nav>
      </div>

      <BottomSheet>
        <SheetsRenderer />
      </BottomSheet>

      <Toast />

      {busy && (
        <div
          id="busyOv"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10,20,35,.35)',
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              border: '4px solid rgba(255,255,255,.35)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'rotB .8s linear infinite',
              display: 'inline-block',
            }}
          />
        </div>
      )}

      <PrintView />
    </>
  );
};
