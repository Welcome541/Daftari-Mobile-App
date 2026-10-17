# إضافات دَفتَري — Daftari Add-ons

هذا المجلد هو نقطة التوسّع في التطبيق. أي ملف يوضع هنا يمكنه إضافة ميزة
جديدة **دون تعديل أي سطر من النواة**.

## كيف تعمل

1. تُوضع ملفات الإضافة داخل `web/src/extensions/`.
2. يُنشأ ملف `web/src/extensions/manifest.json` يصفها:

```json
{
  "extensions": [
    { "file": "my-feature.js", "name": "my-feature", "version": "1.0.0" }
  ]
}
```

3. يُبنى التطبيق: `node web/build.mjs`
4. عند الإقلاع، يقرأ `js/70-registry.js` ملف `extensions/manifest.json`
   ويحمّل كل إضافة بالترتيب، ثم تستدعي كل إضافة
   `DaftariApp.register(...)` نفسها.

## واجهة الإضافة

```js
DaftariApp.register({
  name: 'my-feature',
  version: '1.0.0',
  requires: '>=3.0.0',        // الحد الأدنى من إصدار التطبيق
  init: function (app) {
    // شاشة جديدة
    app.screen('my-screen', function (params) {
      return '<div class="pad">مرحبًا</div>';
    });

    // إجراء جديد يمكن ربطه في أي مكان
    app.action('my-action', function () {
      toast('تم');
    });
  }
});
```

### الدوال المتاحة

| الدالة | الوظيفة |
|---|---|
| `DaftariApp.register(def)` | تسجيل وحدة ميزة (اسم، إصدار، تبعيات، `init`) |
| `DaftariApp.screen(id, fn, meta)` | تسجيل شاشة جديدة قابلة للوصول بـ `go(id)` |
| `DaftariApp.action(id, fn, meta)` | تسجيل إجراء مسمّى |
| `DaftariApp.list()` | وصف كل ما هو مسجَّل |
| `DaftariApp.sheet()` | لوحة تعرض الوحدات والإضافات المحمَّلة |

### قواعد التوافق

- إذا كان `requires` أعلى من إصدار التطبيق، تُرفض الإضافة ويُسجَّل السبب
  في `DaftariApp.list().errors` — لا يتعطّل التطبيق أبدًا.
- التسجيل idempotent: تسجيل الاسم نفسه مرتين لا يكرّر التنفيذ.
- الإضافة التي ترمي استثناءً أثناء `init` تبقى مسجَّلة بحالة `failed`
  ولا تمنع بقية الإضافات من العمل.

## مثال جاهز

راجع `sample/hello.js` و `sample/manifest.json`. انسخهما إلى
`web/src/extensions/` لتفعيلهما.

## التوزيع مع التحديثات

الإضافات جزء من حزمة الواجهة، فهي تصل مع أي تحديث. ويمكن كذلك shipped
إضافة واحدة داخل حزمة تحديث، دون لمس النواة.
