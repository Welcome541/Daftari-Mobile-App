/* Arabic-friendly, domain-neutral speech text helpers for Daftari.
 * This improves text normalization after ASR; it does not change or retrain the acoustic model.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DaftariSpeech = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NUMBER_WORDS = Object.create(null);
  const add = (value, words) => words.forEach(word => { NUMBER_WORDS[normalizeWord(word)] = value; });

  function digits(text) {
    return String(text == null ? '' : text)
      .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
      .replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
      .replace(/٬/g, ',').replace(/٫/g, '.');
  }

  function normalizeWord(word) {
    let value = String(word == null ? '' : word);
    try { value = value.normalize('NFKC'); } catch (_) {}
    return digits(value).toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/\u0640/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ىی]/g, 'ي')
      .replace(/[ة]/g, 'ه')
      .replace(/[ؤ]/g, 'و')
      .replace(/[ئ]/g, 'ي')
      .replace(/ک/g, 'ك');
  }

  function tokenize(text) {
    const source = String(text == null ? '' : text);
    const re = /[0-9٠-٩۰-۹]+(?:[.,٫٬][0-9٠-٩۰-۹]+)?|[A-Za-z]+|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g;
    const out = [];
    let match;
    while ((match = re.exec(source))) {
      const raw = match[0];
      const normalized = normalizeWord(raw);
      if (!normalized) continue;
      out.push({
        raw,
        normalized,
        start: match.index,
        end: match.index + raw.length,
        digits: /^[0-9]+(?:[.,][0-9]+)?$/.test(normalized)
      });
    }
    return out;
  }

  function normalizeText(text) {
    return tokenize(text).map(token => token.normalized).join(' ').trim();
  }

  function addSmall(value, variants) { add(value, variants); }
  addSmall(0, ['صفر', 'زيرو', 'zero', 'oh']);
  addSmall(1, ['واحد', 'واحدة', 'واحده', 'واحدا', 'احد', 'أحد', 'واحداً', 'وحدة', 'وحده', 'one']);
  addSmall(2, ['اثنين', 'اثنان', 'اثنتين', 'اثنتان', 'اثني', 'اثنا', 'اتنين', 'اتنان', 'تنين', 'ثنين', 'جوج', 'زوج', 'two']);
  addSmall(3, ['ثلاثة', 'ثلاث', 'ثلاثه', 'ثلاتة', 'ثلات', 'تلاتة', 'تلاته', 'تلات', 'تلتة', 'تلت', 'three']);
  addSmall(4, ['اربعة', 'أربعة', 'اربع', 'أربع', 'اربعه', 'أربعه', 'ربعة', 'ربعه', 'four']);
  addSmall(5, ['خمسة', 'خمسه', 'خمس', 'خمست', 'خمسا', 'five']);
  addSmall(6, ['ستة', 'سته', 'ست', 'سته', 'سته', 'six']);
  addSmall(7, ['سبعة', 'سبعه', 'سبع', 'seven']);
  addSmall(8, ['ثمانية', 'ثمان', 'ثمانيه', 'تمانية', 'تمانيه', 'تماني', 'تمان', 'تمنية', 'تمنيه', 'تمن', 'تمانية', 'eight']);
  addSmall(9, ['تسعة', 'تسعه', 'تسع', 'nine']);

  add(10, ['عشرة', 'عشر', 'عشره', 'عشره', 'ten']);
  add(11, ['احدعشر', 'حدعش', 'حداش', 'احدعش', 'eleven']);
  add(12, ['اثناعشر', 'اثنيعشر', 'اثناعشر', 'اتناعشر', 'اتنعش', 'اتناش', 'تنعش', 'طناش', 'twelve']);
  add(13, ['ثلاثةعشر', 'ثلاثعشر', 'ثلاثتعش', 'تلاتاشر', 'تلاتعش', 'تلتعشر', 'تلتعش', 'تلتاشر', 'ثلتعش', 'thirteen']);
  add(14, ['اربعةعشر', 'اربعتاشر', 'اربعتعش', 'اربعتاش', 'اربعطاش', 'fourteen']);
  add(15, ['خمسةعشر', 'خمستاشر', 'خمستعش', 'خمستاش', 'خمسطاش', 'fifteen']);
  add(16, ['ستةعشر', 'ستاشر', 'ستعش', 'ستطاش', 'sixteen']);
  add(17, ['سبعةعشر', 'سبعتاشر', 'سبعتعش', 'سبعتاش', 'سبعطاش', 'seventeen']);
  add(18, ['ثمانيةعشر', 'تمانتاشر', 'تمانتعش', 'تمانتاش', 'تمانطاش', 'eighteen']);
  add(19, ['تسعةعشر', 'تسعتاشر', 'تسعتعش', 'تسعتاش', 'تسعطاش', 'nineteen']);

  add(20, ['عشرون', 'عشرين', 'عشرون', 'twenty']);
  add(30, ['ثلاثون', 'ثلاثين', 'تلاتون', 'تلاتين', 'تلتين', 'thirty']);
  add(40, ['اربعون', 'أربعون', 'اربعين', 'أربعين', 'forty']);
  add(50, ['خمسون', 'خمسين', 'fifty']);
  add(60, ['ستون', 'ستين', 'sixty']);
  add(70, ['سبعون', 'سبعين', 'seventy']);
  add(80, ['ثمانون', 'ثمانين', 'تمانون', 'تمانين', 'تمانتين', 'تمانيين', 'تمانين', 'eighty']);
  add(90, ['تسعون', 'تسعين', 'ninety']);

  add(100, ['مئة', 'مائة', 'مئه', 'مية', 'ميه', 'ماية', 'مايه', 'مائه', 'hundred']);
  add(200, ['مئتان', 'مائتان', 'مئتين', 'مائتين', 'ميتين', 'مايتين', 'twohundred']);
  add(300, ['ثلاثمئة', 'ثلاثمائة', 'ثلاثمية', 'تلاتمية', 'تلتماية', 'threehundred']);
  add(400, ['اربعمئة', 'أربعمئة', 'اربعمائة', 'اربعمية', 'أربعمية', 'fourhundred']);
  add(500, ['خمسمئة', 'خمسمائة', 'خمسمية', 'خمماية', 'fivehundred']);
  add(600, ['ستمئة', 'ستمائة', 'ستمية', 'sixhundred']);
  add(700, ['سبعمئة', 'سبعمائة', 'سبعمية', 'sevenhundred']);
  add(800, ['ثمانمئة', 'ثمانمائة', 'ثمانمية', 'تمانمية', 'eight hundred']);
  add(900, ['تسعمئة', 'تسعمائة', 'تسعمية', 'ninehundred']);

  add(1000, ['الف', 'ألف', 'الف', 'آلاف', 'الاف', 'الألاف', 'الآلاف', 'thousand']);
  add(2000, ['الفين', 'ألفين', 'الفان', 'ألفان', 'two thousand']);
  add(1000000, ['مليون', 'مليونين', 'million']);
  add(0.5, ['نص', 'نصف', 'نصه', 'نصين', 'half']);
  add(0.25, ['ربع', 'ربعه', 'quarter']);

  const TEN_UNIT = new Set(['عشر', 'عشرة', 'عشره', 'teen']);
  const CONNECTORS = new Set(['و', 'and']);
  const PRICE_CUES = new Set([
    'سعر', 'السعر', 'بمبلغ', 'مبلغ', 'قيمة', 'قيمه', 'قيمته', 'ثمن', 'ب', 'بـ', 'بـ',
    'بسعر', 'بقيمة', 'حساب', 'الحساب', 'total', 'price', 'for'
  ]);
  const CURRENCIES = new Set([
    'ريال', 'ريالا', 'ريالات', 'ريالين', 'ريالين', 'ر.س', 'ر.ي', 'سار',
    'دينار', 'دينار', 'دنانير', 'درهم', 'درهما', 'دراهم', 'جنيه', 'جنيهات', 'جنيها', 'جنيهين', 'جنية',
    'ليرة', 'ليرات', 'شيكل', 'شواكل', 'دولار', 'دولارات', 'دولاراً', 'قرش', 'قروش', 'هللة', 'هللات', 'فلس', 'فلوس', 'مليم', 'مليمات',
    'ريال', 'جنيه', 'درهم', 'دولار', 'دينار', 'ليره', 'شيكل', 'فقط', 'only', 'riyal', 'riyals', 'dinar', 'dinars', 'dirham', 'dirhams', 'pound', 'pounds', 'dollar', 'dollars', 'shekel', 'shekels', 'sar', 'yer', 'usd', 'eur'
  ].map(normalizeWord));

  function variantsFor(word) {
    const initial = normalizeWord(word);
    const variants = [initial];
    const seen = new Set(variants);
    for (let i = 0; i < variants.length; i++) {
      const value = variants[i];
      const candidates = [];
      if (value.length > 1 && value[0] === 'و') candidates.push(value.slice(1));
      if (value.length > 2 && value.startsWith('ال')) candidates.push(value.slice(2));
      if (value.length > 1 && 'بفكل'.includes(value[0])) candidates.push(value.slice(1));
      for (const candidate of candidates) if (candidate && !seen.has(candidate)) { seen.add(candidate); variants.push(candidate); }
    }
    return variants;
  }

  function wordValue(token) {
    for (const variant of variantsFor(token)) {
      if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, variant)) return NUMBER_WORDS[variant];
    }
    return null;
  }

  function parseDecimal(raw) {
    let value = digits(raw).replace(/[^0-9.,-]/g, '');
    if (!value || !/\d/.test(value)) return 0;
    const commas = (value.match(/,/g) || []).length;
    const dots = (value.match(/\./g) || []).length;
    if (commas && dots) {
      const lastComma = value.lastIndexOf(',');
      const lastDot = value.lastIndexOf('.');
      const decimal = Math.max(lastComma, lastDot);
      const integer = value.slice(0, decimal).replace(/[.,]/g, '');
      const fraction = value.slice(decimal + 1).replace(/[.,]/g, '');
      value = integer + (fraction ? '.' + fraction : '');
    } else if (commas > 1 || (commas === 1 && /,\d{3}$/.test(value))) {
      value = value.replace(/,/g, '');
    } else if (commas === 1) {
      value = value.replace(',', '.');
    } else if (dots > 1) {
      const lastDot = value.lastIndexOf('.');
      value = value.slice(0, lastDot).replace(/\./g, '') + value.slice(lastDot);
    }
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function nextNumberIndex(tokens, start) {
    for (let i = start; i < tokens.length && i <= start + 2; i++) {
      if (wordValue(tokens[i].normalized) !== null || tokens[i].digits) return i;
      if (!CONNECTORS.has(tokens[i].normalized)) break;
    }
    return -1;
  }

  function parseWordRun(tokens, start) {
    let total = 0, current = 0, seen = false, last = start - 1;
    for (let i = start; i < tokens.length;) {
      const token = tokens[i];
      const norm = token.normalized;
      if (CONNECTORS.has(norm)) {
        const next = nextNumberIndex(tokens, i + 1);
        if (seen && next >= 0) { i++; continue; }
        break;
      }
      if (token.digits) break;
      const value = wordValue(norm);
      if (value === null) break;
      seen = true;
      last = i;
      const nextIndex = nextNumberIndex(tokens, i + 1);
      const nextValue = nextIndex >= 0 ? wordValue(tokens[nextIndex].normalized) : null;
      if (value >= 1 && value <= 9 && nextValue === 10 && nextIndex === i + 1 && TEN_UNIT.has(tokens[nextIndex].normalized)) {
        current += 10 + value;
        last = nextIndex;
        i = nextIndex + 1;
        continue;
      }
      if (value >= 1 && value <= 9 && nextValue === 100 && nextIndex === i + 1) {
        current += value * 100;
        last = nextIndex;
        i = nextIndex + 1;
        continue;
      }
      if (value === 100) current = (current || 1) * 100;
      else if (value === 1000 || value === 2000) { total += (current || (value === 2000 ? 2 : 1)) * (value === 2000 ? 1000 : 1000); current = 0; }
      else if (value === 1000000) { total += (current || 1) * value; current = 0; }
      else current += value;
      i++;
    }
    if (!seen) return null;
    return { value: total + current, first: start, last };
  }

  function isCue(token) {
    const variants = variantsFor(token.normalized);
    return variants.some(value => PRICE_CUES.has(value));
  }

  function isCurrency(token) {
    const variants = variantsFor(token.normalized);
    return variants.some(value => CURRENCIES.has(value));
  }

  function scoreCandidate(candidate, tokens) {
    let score = 0;
    for (let i = Math.max(0, candidate.first - 3); i < candidate.first; i++) {
      if (isCurrency(tokens[i])) score += 4;
      if (isCue(tokens[i])) score += 3;
    }
    for (let i = candidate.last + 1; i < Math.min(tokens.length, candidate.last + 4); i++) {
      if (isCurrency(tokens[i])) score += i <= candidate.last + 2 ? 6 : 3;
      if (isCue(tokens[i])) score += 3;
      if (!CONNECTORS.has(tokens[i].normalized) && wordValue(tokens[i].normalized) === null && !isCurrency(tokens[i]) && !isCue(tokens[i])) break;
    }
    // Prefer the complete number phrase (e.g. "ثلاثة وأربعين") over a suffix candidate.
    score += Math.max(0, candidate.last - candidate.first) * 1.5;
    // With otherwise equal candidates, the later number is usually the price.
    score -= candidate.first / Math.max(1, tokens.length) * 0.05;
    return score;
  }

  function parseAmount(text) {
    const tokens = tokenize(text);
    const candidates = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.digits) {
        const value = parseDecimal(token.raw);
        if (value > 0) candidates.push({ value, first: i, last: i, start: token.start, end: token.end, source: 'digits' });
        continue;
      }
      const run = parseWordRun(tokens, i);
      if (!run || run.last < i || run.value <= 0) continue;
      candidates.push({
        value: run.value,
        first: run.first,
        last: run.last,
        start: tokens[run.first].start,
        end: tokens[run.last].end,
        source: 'words'
      });
    }
    if (!candidates.length) return { amt: 0, start: 0, end: 0, source: null };
    candidates.sort((a, b) => scoreCandidate(b, tokens) - scoreCandidate(a, tokens));
    const best = candidates[0];
    return { amt: best.value, start: best.start, end: best.end, source: best.source, tokenStart: best.first, tokenEnd: best.last };
  }

  const PRODUCT_WORDS = new Set([
    'رز','أرز','عيش','حليب','لبن','مويه','ماء','سكر','شاي','قهوة','بن','دقيق','طحين','زيت','خبز','قمح','بيض','جبن','جبنة','مكرونة','معكرونة','صلصة','عسل','تمر','لحم','دجاج','سمك','بطاطس','بطاطا','طماطم','بندورة','بصل','ثوم','ملح','زبدة','صابون','منظف','مسحوق','معلبات','مياه','عصير','سمن','عدس','فول','حبوب','تفاح','موز','برتقال','فواكه','خضار','بامية','فلفل','ليمون','زبادي','لبنة','زبيب','قشطة','مكسرات','شوكولاتة','بسكويت',
    'كرتون','كرتونه','علبة','علب','حبة','حبات','قطعة','قطع','باكيت','كيلو','كجم','جرام','غرام','لتر','زجاجة','قنينة','كيس','صندوق','ربطة','حزمة','متر',
    'rice','milk','sugar','tea','coffee','flour','oil','bread','egg','eggs','cheese','meat','chicken','fish','dates','soap','water','juice'
  ].map(normalizeWord));
  const PRODUCT_UNITS = new Set(['كرتون','كرتونه','علبة','علب','حبة','حبات','قطعة','قطع','باكيت','كيلو','كجم','جرام','غرام','لتر','زجاجة','قنينة','كيس','صندوق','ربطة','حزمة','متر'].map(normalizeWord));
  const PRODUCT_CUES = new Set([
    'منتج','منتجات','المنتج','الصنف','صنف','أصناف','بضاعة','سلعة','سلع','اشتريت','اشتري','شريت','جبت','جلبت','بعت','بيع','اشترى','اخذت','أخذت','خذت','خذ','جيب','هات','مشتريات','طلبية','طلب','product','item','goods','buy','bought','sold'
  ].map(normalizeWord));
  const PRODUCT_NOUN_CUES = new Set(['منتج','منتجات','المنتج','الصنف','صنف','أصناف','بضاعة','سلعة','سلع','product','item','goods'].map(normalizeWord));
  const PAY_WORDS = new Set(['سداد','سدد','سددت','سددلي','سدّدت','دفع','دفعت','دفعتله','استلم','استلمت','وصلني','رجع','رد','ادفع','إيداع','ايداع','تحويل','paid','pay','deposit','received','payment'].map(normalizeWord));
  const DEBT_WORDS = new Set(['دين','دَين','آجل','اجل','على الحساب','سجل','سجّل','قيد','بعت','بيع','اشتريت','اكتب','مديون','debt','owe','credit','record','invoice'].map(normalizeWord));
  const SCOPE_FILLERS = new Set([
    'يا','اي','لو','من','على','الى','لي','له','لها','هذا','هذه','هذي','ذي','دي','ده','هو','هي','عند','عندي','بالله','سمحت','اليوم','الان','الآن','الحين','دحين','توا','بكره','غدا','امس','نقدا','نقدي','كاش','بس','فقط','تمام','للعميل','العميل','للزبون','الزبون','زبون','عميل','مبلغ','سعر','السعر','مصروف','مصاريف','expense','expenses','please','now','cash','only','the','a','an','to','with','for','customer','client'
  ].map(normalizeWord));
  const CURRENCY_QUALIFIERS = new Set(['سعودي','يمني','عماني','قطري','اماراتي','إماراتي','كويتي','بحريني','ليبي','مغربي','عراقي','اردني','مصري','سوري','لبناني','فلسطيني','تونسي','جزائري','موريتاني'].map(normalizeWord));

  function baseWord(word) {
    const n = normalizeWord(word);
    return n.startsWith('ال') && n.length > 2 ? n.slice(2) : n;
  }

  function findCustomer(text, customers) {
    const matches = [];
    (customers || []).filter(c => c && !c.archived && c.name).forEach(customer => {
      const hit = findPhrase(text, customer.name);
      if (hit) matches.push({ customer, hit });
    });
    if (!matches.length) return { customer: null, hit: null, ambiguous: false };
    matches.sort((a, b) => (b.hit.end - b.hit.start) - (a.hit.end - a.hit.start));
    const best = matches[0];
    const ambiguous = matches.some(item => item.customer.id !== best.customer.id &&
      (item.hit.start === best.hit.start && item.hit.end === best.hit.end || item.hit.start >= best.hit.end || best.hit.start >= item.hit.end));
    return ambiguous ? { customer: null, hit: null, ambiguous: true } : { customer: best.customer, hit: best.hit, ambiguous: false };
  }

  function productDetails(text, amountSpan, nameSpan) {
    const residual = [], words = tokenize(text);
    let customCueIndex = -1, hasProductCue = false;
    const overlaps = (token, span) => !!(span && span.end > span.start && token.start < span.end && span.start < token.end);
    for (let i = 0; i < words.length; i++) {
      const token = words[i], word = baseWord(token.normalized);
      if (overlaps(token, amountSpan) || overlaps(token, nameSpan)) continue;
      if (PRODUCT_CUES.has(word)) { hasProductCue = true; if (PRODUCT_NOUN_CUES.has(word) && customCueIndex < 0) customCueIndex = i; continue; }
      if (token.digits || isCue(token) || isCurrency(token) || CURRENCY_QUALIFIERS.has(word) || PAY_WORDS.has(word) || DEBT_WORDS.has(word) || SCOPE_FILLERS.has(word) || wordValue(token.normalized) !== null) continue;
      const known = PRODUCT_WORDS.has(word);
      residual.push({ token, index: i, known, unit: PRODUCT_UNITS.has(word) });
    }
    const unknown = residual.filter(item => !item.known);
    const unknownBeforeCue = unknown.some(item => customCueIndex < 0 || item.index < customCueIndex);
    const customAllowed = customCueIndex >= 0 && !unknownBeforeCue && unknown.length <= 4 && residual.every(item => !item.known || item.unit);
    const valid = unknown.length === 0 || customAllowed;
    const noteParts = residual.filter(item => item.known || (customAllowed && !item.known));
    const note = noteParts.map(item => item.token.raw).join(' ').trim().slice(0, 180);
    const hasProduct = noteParts.some(item => !item.unit);
    return { valid, note, hasProduct, hasProductCue };
  }

  function parseRecord(text, options) {
    const opts = options || {}, amount = opts.amountResult || parseAmount(text);
    const match = findCustomer(text, opts.customers || []);
    const context = opts.contextCustomer && !opts.contextCustomer.archived ? opts.contextCustomer : null;
    const customer = match.customer || context;
    const details = productDetails(text, { start: amount.start, end: amount.end }, match.hit);
    const maxAmount = opts.maxAmount == null ? 1000000 : Number(opts.maxAmount);
    const validAmount = Number(amount.amt) > 0 && Number(amount.amt) <= maxAmount;
    const inScope = !match.ambiguous && validAmount && (!!opts.personal || !!customer) && details.valid && details.hasProduct;
    return {
      name: customer ? customer.name : '',
      customerId: customer ? customer.id : null,
      amount: Number(amount.amt) || 0,
      note: details.note,
      inScope,
      ambiguous: match.ambiguous,
      source: amount.source || null
    };
  }

  function kindFromText(text) {
    const words = tokenize(text).map(token => baseWord(token.normalized));
    const pay = words.some(word => PAY_WORDS.has(word));
    const debt = words.some(word => DEBT_WORDS.has(word));
    return pay === debt ? null : (pay ? 'pay' : 'debt');
  }

  function findPhrase(text, phrase) {
    const haystack = tokenize(text);
    const needle = tokenize(phrase).map(token => token.normalized);
    if (!needle.length) return null;
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let matches = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j].normalized !== needle[j]) { matches = false; break; }
      }
      if (matches) return { start: haystack[i].start, end: haystack[i + needle.length - 1].end, first: i, last: i + needle.length - 1 };
    }
    return null;
  }

  return { digits, normalizeWord, normalizeText, tokenize, findPhrase, parseAmount, parseRecord, kindFromText, wordValue, isCurrency, isCue };
});
