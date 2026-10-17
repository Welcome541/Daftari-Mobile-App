# أدوات الترحيل — Legacy migration tools

هذه الأدوات هي التي فكّكت النسخة 2.22 (ملف `index.html` واحد بحجم 2.1 ميغابايت)
إلى بنية النسخة 3.0. **لا تُستخدم في البناء اليوم**؛ هي موجودة توثيقًا لكيفية
تمّت عملية الترحيل، ولإعادة التحقق منها.

> تحتاج الأدوات النسخة الأصلية من `index.html`:
> `git show <commit>:app/src/main/assets/www/index.html > original-index.html`

| الأداة | الوظيفة |
|---|---|
| `split-legacy-js.py` | يقطع سكربت التطبيق إلى وحدات حسب حدود الجُمل (acorn)، **ويثبت** أن تدفّق الرموز مطابق للأصل تمامًا |
| `extract-legacy-css.mjs` | يقسّم `<style>` الأصلي إلى طبقات **بدون فقد** (يتحقق أن كل قاعدة صدرت) |
| `merge-legacy-css.mjs` | يدمج الطبقات المستخرجة مع طبقة المقاسات المرتبطة بالرموز |
| `patch-modules.py` | يطبّق تعديلات الميزات (نصوص الترجمة، ختم البناء، صفوف الإعدادات) على الوحدات |

## كيف تُعاد التحقق

```bash
# 1. الوحدات مطابقة للأصل رمزًا برمز
cd web/tools/legacy
python3 split-legacy-js.py
#    → original tokens 51636 / modular tokens 51636 / TOKEN STREAM IDENTICAL : True

# 2. لا قاعدة CSS مفقودة
node extract-legacy-css.mjs ../../../../original-index.html /tmp/css-extracted
#    → original top level nodes : 205 / lost : 0

# 3. أنماط Java سليمة نحويًا
node ../javacheck.mjs
```

## لماذا نُبقيها

الترحيل قرار غير قابل للعكس بسهولة. وجود هذه الأدوات يجعله **قابلًا
للمراجعة**: يستطيع أي مطوّر أن يعيد تشغيلها على النسخة الأصلية ويقارن
الناتج بما هو في المستودع اليوم.
