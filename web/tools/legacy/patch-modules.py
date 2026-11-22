#!/usr/bin/env python3
"""Apply the feature patches on top of the mechanically split modules.

Kept separate from split_js.py so the split stays a pure, verifiable
transformation of the original source while the feature work is explicit
and re-runnable.
"""
import os, re, sys

JSDIR = "/home/user/Daftari-Mobile-App/web/src/js"
ROWS = open("/tmp/work/settings_rows.js", encoding="utf-8").read()

AR_NEW = (
"updT:'التحديث',updCheck:'فحص التحديثات',updUpToDate:'أنت على أحدث إصدار',updAvailable:'يتوفّر تحديث',"
"updInstall:'تثبيت التحديث',updInstalling:'جارٍ التثبيت…',updInstalled:'تم التحديث ✓',updFailed:'فشل التحديث',"
"updFromFile:'تحديث من ملف',updRollback:'الرجوع للإصدار السابق',updRolledBack:'تم الرجوع ✓',"
"updBundle:'حزمة الواجهة',updSource:'مصدر التحديث',updOfflineNote:'التحديث يعمل دون إنترنت عبر ملف التحديث',"
"updNoNative:'تثبيت التحديثات يحتاج تطبيق أندرويد',updInvalid:'الملف تالف أو غير متوافق',"
"updConfirm:'تثبيت هذا التحديث؟',updReload:'إعادة التشغيل الآن',updNeedReload:'أعد التشغيل لتطبيق التحديث',"
"updNativeMissing:'التحديث غير متاح في هذه النسخة',updNoBundle:'لا توجد حزمة محدَّثة',updCheckFail:'تعذّر الفحص',"
"updCorrupt:'فشل التحقق من سلامة الحزمة',updOk:'الحزمة سليمة',updPending:'بانتظار التثبيت',"
"appearT:'العرض والمقاسات',uiScaleT:'حجم الواجهة',uiDensityT:'كثافة العرض',"
"uiScaleS:'صغير',uiScaleM:'متوسط',uiScaleL:'كبير',uiScaleXL:'كبير جدًا',"
"uiDensityC:'مضغوط',uiDensityN:'عادي',uiDensityR:'مريح',"
"extensT:'الإضافات',extensD:'إضافات اختيارية توسّع التطبيق',noExtens:'لا توجد إضافات',"
"modT:'الوحدات',modLoaded:'محمّلة',modFailed:'فشل تحميل',")

EN_NEW = (
"updT:'Update',updCheck:'Check for updates',updUpToDate:'You are up to date',updAvailable:'Update available',"
"updInstall:'Install update',updInstalling:'Installing…',updInstalled:'Updated ✓',updFailed:'Update failed',"
"updFromFile:'Update from file',updRollback:'Roll back to previous',updRolledBack:'Rolled back ✓',"
"updBundle:'Interface bundle',updSource:'Update source',updOfflineNote:'Updates work offline via an update file',"
"updNoNative:'Installing updates requires the Android app',updInvalid:'The file is corrupt or incompatible',"
"updConfirm:'Install this update?',updReload:'Restart now',updNeedReload:'Restart to apply the update',"
"updNativeMissing:'Updates are unavailable in this build',updNoBundle:'No update package found',updCheckFail:'Check failed',"
"updCorrupt:'Bundle integrity check failed',updOk:'Bundle verified',updPending:'Ready to install',"
"appearT:'Display & sizing',uiScaleT:'Interface size',uiDensityT:'Display density',"
"uiScaleS:'Small',uiScaleM:'Medium',uiScaleL:'Large',uiScaleXL:'Extra large',"
"uiDensityC:'Compact',uiDensityN:'Regular',uiDensityR:'Roomy',"
"extensT:'Add-ons',extensD:'Optional add-ons that extend the app',noExtens:'No add-ons',"
"modT:'Modules',modLoaded:'loaded',modFailed:'failed to load',")


def read(p):
    return open(os.path.join(JSDIR, p), encoding="utf-8").read()


def write(p, s):
    open(os.path.join(JSDIR, p), "w", encoding="utf-8").write(s)


# ---------------------------------------------------------------- i18n
p = "01-i18n.js"
s = read(p)
if "updT:" not in s:
    first = s.index("shareGot:")
    s = s[:first] + AR_NEW + s[first:]
    last = s.rindex("shareGot:")
    s = s[:last] + EN_NEW + s[last:]
    write(p, s)
    print("i18n: update/appearance strings added")
else:
    print("i18n: already patched")

# ---------------------------------------------------------------- build stamp
p = "10-router.js"
s = read(p)
if "window.__DF_BUILD" not in s:
    s = s.replace(
        "window.__BUILD='v2.20-clean';",
        "window.__BUILD=(window.__DF_BUILD&&window.__DF_BUILD.version)||'3.0.0';\n"
        "window.__BUILD_INFO=window.__DF_BUILD||{version:window.__BUILD,build:0,channel:'dev'};")
    write(p, s)
    print("router: build stamp wired")
else:
    print("router: already patched")

# ---------------------------------------------------------------- settings rows
p = "33-screen-settings.js"
s = read(p)
if "Appearance.sheet()" not in s:
    anchor = " '<div class=\"muted\" style=\"text-align:center;font-size:11px;padding:16px 0 6px\">'+t('ver')"
    assert anchor in s, "settings anchor not found"
    s = s.replace(anchor, ROWS + anchor, 1)
    write(p, s)
    print("settings: appearance / update / add-on rows added")
else:
    print("settings: already patched")

print("patch complete")
