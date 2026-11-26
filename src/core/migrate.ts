import type { Customer, DaftariDB, Invoice, Lang, Payment } from '../types/daftari';
import { Invariants } from './ledger';

export function seed(): DaftariDB {
  const lang: Lang = (navigator.language || '').slice(0, 2).toLowerCase() === 'ar' ? 'ar' : 'en';
  return {
    meta: { schemaVersion: 3 },
    lang,
    active: 'a1',
    accounts: [{ id: 'a1', name: 'بقالة الندى', type: 'grocery', cur: 'ر.س', minorUnit: 2 }],
    data: { a1: { customers: [], invoices: [], payments: [], seq: 500 } },
  };
}

export function demoFixtures(): DaftariDB {
  const c = (
    id: string,
    nm: string,
    ph: string,
    since: string,
    pin?: boolean,
    extra?: Partial<Customer>
  ): Customer => ({
    id,
    name: nm,
    phone: ph,
    since,
    archived: false,
    pinned: !!pin,
    limit: (extra && extra.limit) || null,
    photo: null,
    ...extra,
  });

  const at = (day: number, h: number, m: number): number => {
    const d = new Date();
    d.setDate(d.getDate() - day);
    if (day >= 6) {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(h, m, 0, 0);
    }
    return d.getTime();
  };

  const hasTimeForDay = (day: number): boolean => day < 6;

  // 34 realistic customers + 2 archived customers covering VIP pinned, credit limits, overdue, settled, & credit balance
  const cs: Customer[] = [
    c('c1', 'أبو خالد السبيعي', '050 912 3344', '2022', true, { limit: 300000 }),
    c('c2', 'أم سارة الدوسري', '053 246 8101', '2023', true, { limit: 150000 }),
    c('c3', 'مطعم الفجر الشعبي', '055 412 8890', '2022', true, { limit: 500000 }),
    c('c4', 'سعد القحطاني', '054 987 6543', '2023', true, { limit: 200000 }),
    c('c5', 'مؤسسة الأفق للتموين', '011 445 6789', '2021', true, { limit: 1000000 }),
    c('c6', 'محمد العلي', '050 456 7291', '2024', false, { limit: 100000 }),
    c('c7', 'نور الهادي', '056 135 7924', '2024'),
    c('c8', 'حسن الحربي', '055 210 8843', '2023', false, { limit: 120000 }),
    c('c9', 'خالد العتيبي', '050 318 4421', '2023', false, { limit: 80000 }),
    c('c10', 'فهد الشهري', '054 712 9034', '2024'),
    c('c11', 'عبدالله الغامدي', '053 884 1209', '2022', false, { limit: 250000 }),
    c('c12', 'تركي المطيري', '056 441 7720', '2024'),
    c('c13', 'يوسف الشمري', '050 662 3198', '2023', false, { limit: 100000 }),
    c('c14', 'ناصر الدوسري', '055 901 2345', '2023'),
    c('c15', 'عمر الزهراني', '054 330 8871', '2024'),
    c('c16', 'سلطان المالكي', '050 778 9912', '2023', false, { limit: 150000 }),
    c('c17', 'فاطمة السالم', '053 609 4412', '2024'),
    c('c18', 'أم فيصل', '055 128 7743', '2023'),
    c('c19', 'مخبز الواحة', '011 289 5510', '2022', false, { limit: 400000 }),
    c('c20', 'كافيه الركن الهادي', '056 702 1190', '2024', false, { limit: 350000 }),
    c('c21', 'إبراهيم البقمي', '050 845 6612', '2023'),
    c('c22', 'ماجد الجهني', '054 219 8804', '2024'),
    c('c23', 'بدر العنزي', '055 390 1122', '2023'),
    c('c24', 'عادل العمري', '053 512 6640', '2024'),
    c('c25', 'راشد الخالدي', '050 734 2219', '2022'),
    c('c26', 'حمود الرشيدي', '056 890 3311', '2023'),
    c('c27', 'وليد الصالح', '054 118 4490', '2024'),
    c('c28', 'منصور الحازمي', '055 643 2201', '2023'),
    c('c29', 'صالح النجراني', '050 923 1184', '2024'),
    c('c30', 'زياد الشريف', '053 447 9082', '2024'),
    c('c31', 'أبو ياسر', '055 811 2093', '2023'),
    c('c32', 'طارق المري', '056 320 7718', '2024'),
    c('c33', 'فيصل الفهد', '050 554 8810', '2023'),
    c('c34', 'أم ريم', '054 671 3392', '2024'),
    c('c35', 'أبو طلال — حساب قديم', '050 100 9988', '2021', false, { archived: true }),
    c('c36', 'بقالة التوفير — منتهي', '011 800 4433', '2022', false, { archived: true }),
  ];

  const is: Invoice[] = [];
  const ps: Payment[] = [];
  let seq = 840;

  const addInv = (
    cust: string,
    day: number,
    h: number,
    m: number,
    amount: number,
    note: string,
    due?: number | null,
    extra?: Partial<Invoice>
  ): string => {
    const id = 'i' + (is.length + 1);
    is.push({
      id,
      code: (extra?.k === 'open' ? 'OPN-' : 'A') + seq++,
      cust,
      ts: at(day, h, m),
      amount,
      note,
      due: due || null,
      createdAt: Date.now() - day * 864e5,
      hasTime: hasTimeForDay(day),
      ...extra,
    });
    return id;
  };

  const addPay = (
    cust: string,
    day: number,
    h: number,
    m: number,
    amount: number,
    method: 'cash' | 'transfer' | 'cardpay',
    alloc: { inv: string; amt: number }[] = []
  ) => {
    ps.push({
      id: 'p' + (ps.length + 1),
      cust,
      ts: at(day, h, m),
      amount,
      method,
      alloc,
      createdAt: Date.now() - day * 864e5,
      hasTime: hasTimeForDay(day),
    });
  };

  const now = Date.now();
  const D = 864e5;

  // --- Today (day 0) ---
  const iToday1 = addInv('c1', 0, 8, 25, 185, 'أرز بسمتي 10 كيلو وزيت طبخ');
  addInv('c2', 0, 9, 40, 95, 'خبز طازج وحليب وأجبان');
  addInv('c3', 0, 11, 15, 640, 'تموين مطبخ: دقيق وطماطم وبصل ولحوم');
  addInv('c6', 0, 13, 10, 140, 'مقاضي منزلية ومشروبات');
  addPay('c2', 0, 14, 5, 200, 'cash', [{ inv: iToday1, amt: 0 }]);
  addPay('c4', 0, 15, 30, 350, 'transfer');

  // --- Yesterday & Last 5 days ---
  const i1 = addInv('c1', 1, 10, 15, 320, 'سكر وشاي وقهوة ومعلبات');
  const i2 = addInv('c4', 1, 17, 45, 460, 'خضروات وفواكه وعصائر للبيت');
  addPay('c1', 1, 19, 20, 250, 'cash', [{ inv: i1, amt: 250 }]);
  addPay('c6', 1, 20, 10, 140, 'cardpay');

  const i3 = addInv('c5', 2, 9, 30, 1450, 'طلبية تموين شهرية للمؤسسة');
  addInv('c7', 2, 16, 15, 78, 'مياه معدنية وبسكويت وعصير');
  addInv('c8', 2, 21, 5, 290, 'منظفات ومسحوق غسيل وشامبو');
  addPay('c3', 2, 18, 0, 500, 'transfer');

  addInv('c9', 3, 11, 50, 215, 'لحوم ودواجن مبردة');
  addInv('c10', 3, 19, 40, 125, 'بيض وحليب وزبدة ومربى');
  addPay('c4', 3, 21, 0, 460, 'cash', [{ inv: i2, amt: 460 }]);

  addInv('c11', 4, 14, 20, 580, 'مستلزمات ضيافة وتمور وقهوة عربية');
  addInv('c12', 4, 18, 35, 92, 'فواكه موسمية وخضار');
  addPay('c5', 4, 16, 10, 900, 'transfer', [{ inv: i3, amt: 900 }]);

  addInv('c13', 5, 10, 5, 340, 'أرز ودقيق وزيوت نباتية');
  addInv('c14', 5, 15, 45, 165, 'مقاضي الإفطار وأجبان');
  addPay('c7', 5, 17, 30, 78, 'cash');

  // --- 1 to 4 weeks ago ---
  addInv('c15', 7, 10, 0, 230, 'خضروات وفواكه مشكلة');
  addInv('c16', 8, 11, 0, 720, 'طلبية عائلية كاملة');
  addPay('c16', 9, 12, 0, 300, 'cash');
  addInv('c17', 10, 9, 0, 145, 'حليب أطفال وحفاضات');
  addInv('c18', 11, 14, 0, 260, 'مواد غذائية ومعلبات');
  addPay('c18', 12, 16, 0, 260, 'transfer');
  addInv('c19', 13, 8, 0, 890, 'طحين وسكر وخميرة وزيت');
  addPay('c19', 14, 11, 0, 600, 'transfer');
  addInv('c20', 15, 10, 0, 540, 'حليب طويل الأجل وسكر وبن');
  addPay('c20', 16, 13, 0, 540, 'cardpay');
  addInv('c21', 17, 15, 0, 180, 'مشروبات غازية وعصائر');
  addInv('c22', 18, 12, 0, 310, 'أرز ومكرونة وصلصة طماطم');
  addPay('c22', 19, 17, 0, 150, 'cash');
  addInv('c23', 20, 9, 0, 420, 'لحوم مجمدة وبهارات');
  addInv('c24', 21, 16, 0, 135, 'مستلزمات منزلية ومنظفات');
  addPay('c24', 22, 18, 0, 135, 'cash');
  addInv('c25', 24, 11, 0, 610, 'طلبية أسبوعية كاملة');
  addPay('c25', 25, 14, 0, 200, 'transfer');
  addInv('c26', 26, 10, 0, 275, 'خضار وفواكه وتمور');
  addInv('c27', 27, 13, 0, 195, 'خبز وحليب وجبن');
  addPay('c27', 28, 15, 0, 195, 'cardpay');

  // --- Opening balance & Edited/Return invoice ---
  addInv('c8', 29, 9, 0, 450, 'رصيد من الدفتر السابق', null, { k: 'open' });
  const edId = addInv('c9', 14, 12, 0, 480, 'طلبية مناسبة — بعد المرتجع', null, {
    edits: [{ ts: now - 10 * D, from: 60000, to: 48000, note: 'إرجاع كرتون عصير', kind: 'return' }],
  });
  addPay('c9', 13, 18, 0, 180, 'cash', [{ inv: edId, amt: 180 }]);

  // --- Advance credit customer (paid more than owed) ---
  addInv('c28', 16, 10, 0, 300, 'طلبية تموين أولي');
  addPay('c28', 15, 14, 0, 500, 'transfer'); // 200 ر.س رصيد دائن لصالح العميل

  // --- Historical Months (1 to 8 months back — shows across Reports 6-month chart & All-time Feed) ---
  const histEntries: [string, number, number, string, number?][] = [
    ['c1', 35, 520, 'مقاضي بداية الشهر الماضي', 300],
    ['c3', 42, 1180, 'طلبية مطعم شاملة', 1180],
    ['c5', 50, 1650, 'توريد بضائع ومشروبات', 1400],
    ['c11', 58, 430, 'قهوة عربية وهيل وتمر', 430],
    ['c19', 65, 960, 'دقيق فاخر وزيت نباتي', 960],
    ['c29', 72, 240, 'خضروات ومواد غذائية', 100],
    ['c30', 80, 385, 'مستلزمات منزلية ومنظفات', 385],
    ['c1', 94, 490, 'طلبية عائلية شهرية', 490],
    ['c3', 102, 1320, 'تموين مواد جافة وزيوت', 1100],
    ['c5', 115, 2100, 'تجهيز مستودع المؤسسة', 2100],
    ['c31', 124, 310, 'أرز وسكر وشاي', 150],
    ['c32', 138, 175, 'مقاضي يومية وحليب', 175],
    ['c2', 150, 280, 'أجبان وألبان ومخبوزات', 280],
    ['c33', 165, 540, 'لحوم ودواجن ومشروبات', 300],
    ['c34', 178, 220, 'مقاضي بيت شهرية', 220],
    ['c1', 195, 610, 'طلبية موسمية شاملة', 610],
    ['c5', 212, 1850, 'توريد شهر كامل للمؤسسة', 1850],
    ['c19', 228, 790, 'مواد خام للمخبز', 790],
    ['c35', 240, 350, 'حساب سابق — مسدد بالكامل', 350],
  ];

  histEntries.forEach(([cid, day, amt, note, paidAmt], idx) => {
    const invId = addInv(cid, day, 11, (idx * 7) % 60, amt, note);
    if (paidAmt && paidAmt > 0) {
      addPay(
        cid,
        Math.max(1, day - 2),
        17,
        (idx * 11) % 60,
        paidAmt,
        idx % 3 === 0 ? 'transfer' : idx % 3 === 1 ? 'cash' : 'cardpay',
        [{ inv: invId, amt: Math.min(amt, paidAmt) }]
      );
    }
  });

  // Scale amounts to integer minor units (halalas)
  is.forEach((i) => (i.amount = Math.round(i.amount * 100)));
  ps.forEach((pp) => {
    pp.amount = Math.round(pp.amount * 100);
    pp.alloc.forEach((a) => (a.amt = Math.round(a.amt * 100)));
  });

  // Secondary branch account ('a2') with realistic initial data
  const cs2: Customer[] = [
    c('b1', 'صالح العمري', '050 223 4411', '2024', true, { limit: 100000 }),
    c('b2', 'مها الحربي', '055 812 9901', '2024'),
    c('b3', 'ديوانية الضيافة', '054 309 1122', '2023', false, { limit: 300000 }),
    c('b4', 'عبدالعزيز السالم', '056 440 8821', '2024'),
  ];
  const is2: Invoice[] = [
    { id: 'bi1', code: 'B101', cust: 'b1', ts: at(0, 10, 20), createdAt: now, hasTime: true, amount: 16500, note: 'مشروبات وقهوة ومكسرات' },
    { id: 'bi2', code: 'B102', cust: 'b3', ts: at(2, 14, 10), createdAt: now - 2 * D, hasTime: true, amount: 48000, note: 'مستلزمات ضيافة وتمور' },
    { id: 'bi3', code: 'B103', cust: 'b2', ts: at(5, 18, 0), createdAt: now - 5 * D, hasTime: true, amount: 9500, note: 'خبز وحليب وفواكه' },
  ];
  const ps2: Payment[] = [
    { id: 'bp1', cust: 'b3', ts: at(1, 16, 0), createdAt: now - D, hasTime: true, amount: 25000, method: 'transfer', alloc: [{ inv: 'bi2', amt: 25000 }] },
    { id: 'bp2', cust: 'b2', ts: at(4, 19, 30), createdAt: now - 4 * D, hasTime: true, amount: 9500, method: 'cash', alloc: [{ inv: 'bi3', amt: 9500 }] },
  ];

  const lang: Lang = (navigator.language || '').slice(0, 2).toLowerCase() === 'ar' ? 'ar' : 'en';
  return {
    meta: { schemaVersion: 3 },
    lang,
    active: 'a1',
    accounts: [
      { id: 'a1', name: 'بقالة الندى', type: 'grocery', cur: 'ر.س', minorUnit: 2 },
      { id: 'a2', name: 'فرع الروضة', type: 'grocery', cur: 'ر.س', minorUnit: 2 },
    ],
    data: {
      a1: { customers: cs, invoices: is, payments: ps, seq },
      a2: { customers: cs2, invoices: is2, payments: ps2, seq: 104 },
    },
  };
}

const MIGRATIONS = [
  {
    to: 2,
    run(x: any): any {
      for (const aid in x.data) {
        const d = x.data[aid];
        (d.invoices || []).forEach((i: any) => {
          i.amount = Math.round((Number(i.amount) || 0) * 100);
          (i.edits || []).forEach((e: any) => {
            e.from = Math.round((Number(e.from) || 0) * 100);
            e.to = Math.round((Number(e.to) || 0) * 100);
          });
        });
        (d.payments || []).forEach((pp: any) => {
          pp.amount = Math.round((Number(pp.amount) || 0) * 100);
          (pp.alloc || []).forEach((a: any) => (a.amt = Math.round((Number(a.amt) || 0) * 100)));
        });
        (d.customers || []).forEach((c: any) => {
          if (c.limit) c.limit = Math.round(Number(c.limit) * 100);
        });
      }
      (x.accounts || []).forEach((a: any) => (a.minorUnit = a.minorUnit || 2));
      return x;
    },
  },
  {
    to: 3,
    run(x: any): any {
      for (const aid in x.data) {
        const d = x.data[aid];
        (d.invoices || []).forEach((i: any) => {
          if (i.createdAt == null) i.createdAt = i.ts;
          if (i.hasTime == null) {
            const dt = new Date(i.ts);
            i.hasTime = !(dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0);
          }
        });
        (d.payments || []).forEach((p: any) => {
          if (p.createdAt == null) p.createdAt = p.ts;
          if (p.hasTime == null) {
            const dt = new Date(p.ts);
            p.hasTime = !(dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0);
          }
        });
      }
      return x;
    },
  },
];

export function migrate(x: any): DaftariDB {
  let base: any;
  if (x && x.accounts && x.data) base = x;
  else {
    base = seed();
    if (x && x.customers) {
      base.data.a1 = {
        customers: x.customers,
        invoices: x.invoices || [],
        payments: x.payments || [],
        seq: x.seq || 500,
      };
      if (x.lang) base.lang = x.lang;
      if (x.cur) base.accounts[0].cur = x.cur;
      if (x.accName) base.accounts[0].name = x.accName;
    }
  }
  base.meta = base.meta || { schemaVersion: 1 };
  const from = base.meta.schemaVersion || 1;
  if (from < 3) {
    try {
      localStorage.setItem('v1raw', JSON.stringify(base));
    } catch {
      // ignore
    }
  }
  for (const m of MIGRATIONS) {
    if ((base.meta.schemaVersion || 1) < m.to) {
      try {
        base = m.run(base);
        base.meta.schemaVersion = m.to;
        const bad = Invariants.check(base);
        if (bad) throw new Error(bad);
      } catch {
        try {
          const r = JSON.parse(localStorage.getItem('v1raw') || 'null');
          if (r) return r;
        } catch {
          // ignore
        }
      }
    }
  }
  return base as DaftariDB;
}
