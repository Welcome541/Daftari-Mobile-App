/* =====================================================================
 * Daftari · مثال إضافة (Add-on example)
 * ---------------------------------------------------------------------
 * هذه الإضافة لا تُحمَّل تلقائيًا. لتفعيلها:
 *   1. انسخ هذا الملف إلى  web/src/extensions/hello.js
 *   2. انسخ sample/manifest.json إلى web/src/extensions/manifest.json
 *   3. أعد البناء:  node web/build.mjs
 *
 * كل ما تفعله الإضافة يمر عبر واجهة DaftariApp، فلا تحتاج إلى تعديل
 * أي سطر في نواة التطبيق.
 * ===================================================================== */
DaftariApp.register({
  name: 'hello',
  version: '1.0.0',
  requires: '>=3.0.0',

  init: function (app) {
    // شاشة جديدة يمكن فتحها بـ go('hello')
    app.screen('hello', function (params) {
      return '<div class="hdr"><button class="hbtn" onclick="back()">‹</button>' +
        '<div class="sp" style="text-align:center"><h1>مرحبًا</h1></div>' +
        '<div style="width:42px"></div></div>' +
        '<div class="pad"><div class="card" style="padding:18px">' +
        '<div style="font-weight:800;margin-bottom:8px">إضافة تجريبية</div>' +
        '<div class="muted" style="font-size:12.5px;line-height:1.9">' +
        'هذه الشاشة أضافتها إضافة خارجية لم تُعدّل نواة التطبيق.' +
        '</div></div></div>';
    });

    // إجراء مسمّى يمكن ربطه في أي مكان داخل التطبيق
    app.action('hello.say', function () {
      if (typeof toast === 'function') toast('مرحبًا من الإضافة ✓');
    });
  }
});
