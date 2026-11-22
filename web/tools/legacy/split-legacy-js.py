#!/usr/bin/env python3
"""Split the Daftari app script into focused modules using a real JS parser.

The original app is one giant <script>.  We parse it with acorn, group the
top-level statements by the identifier they declare, and emit one classic
script per module.  Classic scripts share the global scope, so the resulting
runtime contract is identical to the original single-file build.
"""
import json, os, subprocess, re

ROOT = "/home/user/Daftari-Mobile-App"
JSDIR = os.path.join(ROOT, "web/src/js")
os.makedirs(JSDIR, exist_ok=True)

# ---------------------------------------------------------------- module map
# module name -> (title, [declared top-level identifiers])
MODULES = [
    ("00-icons", "Icon set + <svg> renderer", ["P", "ic"]),
    ("01-i18n", "Translations (ar/en) + t() lookup", ["STR", "VOC", "isP", "t"]),
    ("02-security", "App state + secure-at-rest crypto primitives",
     ["PLAIN", "SECK", "ENC", "MIN", "H", "D", "uid", "db", "sec", "saveSec", "save",
      "te", "td", "sha256hex", "deriveKey", "newMaster", "wrapKey", "unwrapKey",
      "encJSON", "decJSON"]),
    ("03-storage", "IndexedDB store (primary) + localStorage cache", ["Store"]),
    ("04-backup", "Versioned backup / restore with checksum", ["Backup"]),
    ("05-ledger", "Pure ledger engine + data invariants", ["Ledger", "Invariants"]),
    ("06-migrate", "Seed, demo fixtures, schema migrations",
     ["seed", "demoFixtures", "MIGRATIONS", "migrate"]),
    ("07-data", "Data access layer + derived indexes",
     ["curAcc", "DD", "cust", "_IX", "ix", "_LL", "libLoad", "_cd", "debList",
      "_td", "debTx", "invEdited", "lastEdit", "openReturnSheet", "addOpening",
      "openOpeningSheet", "applyReturn", "invRem", "invStatus", "custInvoices",
      "custOpen", "openTotal", "custPaid", "custPurch", "custCount", "lastAct",
      "isOverdue", "custOverdue", "dueVal", "isToday", "collToday"]),
    ("08-format", "Money / date / avatar formatting",
     ["normAr", "MU", "fmt", "Money", "CUR", "money", "MON", "dateStr", "timeStr",
      "rel", "initials", "AVC", "avColor", "avat", "esc", "STLBL", "badge"]),
    ("09-feedback", "Haptics + speech feedback", ["AC", "speak", "feedback"]),
    ("10-router", "Navigation stack + UI state",
     ["stack", "__BUILD", "ui", "tab", "go", "back", "curScr", "ctxCust"]),
    ("11-voice", "Pluggable speech-recognition engine", ["VoiceEngine"]),
    ("20-shell", "Shell chrome: header, account chip, stat cards",
     ["accInit", "accChip", "headerBar", "todayExp", "statsCards", "pdig",
      "custOverAmt", "custOverSince", "NEARLIM", "limitState", "lastOpTxt"]),
    ("21-customers", "Customer list, filtering, multi-select",
     ["filteredCustomers", "custRow", "clKey", "clLP", "clDownT", "clDownP",
      "clMoveC", "clUpC", "clOpen", "cselPin", "cselEdit", "cselShare",
      "cselStop", "cselDelete", "custSelBar", "cFCount", "custFilterBtn",
      "refreshCFilterBtn", "fChips", "clearFCond", "setQuick", "openCustNavMenu",
      "openCustFilter", "custCounts", "renderCustSheet", "setCSt", "toggleFLim",
      "setCSo"]),
    ("22-tx", "Transaction feed model + rows",
     ["txAll", "filteredTx", "txRow", "lxFired", "lxKey", "txLP", "txDownT",
      "txDownP", "txMoveC", "txUpC"]),
    ("23-selection", "Selection gestures, clipboard, bulk actions",
     ["VIS_SEL", "locCodeFor", "legacyCopy", "locT", "locX", "locY", "locDown",
      "locMove", "locUp", "txOpen", "selXlsx", "openHomeMenu", "selDelete"]),
    ("24-transfer", "Trash, WhatsApp/SMS, Bluetooth, QR transfer",
     ["trashRestore", "trashPurge", "waRemind", "btDev", "btChar", "BT_SERV",
      "connectBT", "btWrite", "printBT", "btStatement", "qrB64", "openQrSend",
      "qrDecompress", "stopQr", "openQrStmt", "openQrRecv", "qrApply", "selFind",
      "fallbackCopy", "selShare", "selArchive"]),
    ("25-feed", "Home feed rendering helpers",
     ["hfBadge", "openHomeFilter", "setHF", "setHP", "toggleDebt", "togglePay",
      "dayLabel", "feedHtml", "privBtn"]),
    ("30-screen-home", "SCREEN: home", ["S_home", "selBarHtml"]),
    ("31-screen-customers", "SCREEN: customers + archive",
     ["S_customers", "archCount", "archBtn", "archListBody", "custListBody"]),
    ("32-screen-reports", "SCREEN: reports", ["repBody", "S_reports"]),
    ("33-screen-settings", "SCREEN: settings", ["S_settings"]),
    ("34-screen-profile", "SCREEN: customer profile + invoice",
     ["focusCard", "shareOne", "custFeed", "cfRow", "openPayDet", "openInvEdit",
      "saveInvEdit", "S_profile", "invCard", "S_invoice"]),
    ("35-screen-voice", "SCREEN: voice capture", ["S_voice"]),
    ("36-recognition", "Arabic/English number parsing + recording",
     ["waveHtml", "voiceStart", "voiceToggleEdit", "voiceConfirm", "recPend",
      "recEnd", "DEMOP", "touchSeen", "lpLast", "lpGuard", "btnDownT", "btnDownP",
      "btnUpT", "btnUpP", "btnClick", "lpBtn", "btnDown", "btnCancelRec",
      "btnUp", "startRec", "learnCorrection", "amtFromText", "HU", "W1", "W10",
      "E1", "E10", "hunMul", "words2num", "parseSay", "handleSay", "extSay",
      "tryWebASR", "endRec", "payImpactFor", "recFieldsHtml", "S_rec",
      "readRecFields", "cancelRec", "recConfirm"]),
    ("37-screen-reportb", "SCREEN: custom report builder",
     ["__dd", "dedupe", "repRangeCalc", "repData", "repNm", "repRows",
      "exportRepXlsx", "printRep", "openRepCust", "repBars", "S_repb", "goWiz"]),
    ("38-screen-wizard", "SCREEN: guided debt/payment wizard",
     ["wizExit", "wzSel", "wzReList", "wzListHtml", "wizCustCard", "wizNext",
      "wzLive", "wizConfirm", "S_wiz", "wzLiveHtml"]),
    ("39-screen-newcust", "SCREEN: new / edit customer",
     ["S_newcust", "saveCustomer", "openPhotoSheet", "pickPhoto", "removePhoto"]),
    ("40-sheets", "Bottom-sheet framework + account sheet",
     ["openSheet", "closeSheet", "accRow", "openAccSheet", "renderAccSheet",
      "switchAcc", "saveAccEdit"]),
    ("41-sheets-customer", "Customer sheets: archive, export, import",
     ["openCustMenu", "confirmArchive", "confirmRestore", "togglePin",
      "openExport", "openPaper", "paperReview", "paperCommit", "openImport",
      "importRows", "doImport", "startMicMeter", "stopMicMeter", "retryRec",
      "recNewCust", "openCurSheet", "saveCur", "openContacts", "openCustPicker"]),
    ("42-quickactions", "Long-press quick actions",
     ["lpT", "openQuick", "openFabSheet", "quickPay", "quickPaySave"]),
    ("43-exports", "Export / share / print",
     ["statementText", "shareReceipt", "sendWA", "sendSMS", "dl", "exportCSV",
      "csvC", "exportAll", "exportPDF"]),
    ("44-lock", "PIN lock, fingerprint, auto-lock",
     ["pinBuf", "S_lock", "pinTap", "verifyPin", "askPin", "disableLock", "fpDel",
      "addFp", "fpUnlock"]),
    ("45-toast", "Toast / snackbar",
     ["lastTouch", "toastTimer", "undoAct", "toastMsg", "hideToast", "doneSnack",
      "doUndoAct"]),
    ("46-prefs", "Language, currency, theme",
     ["COUNTRIES", "cName", "setCur", "setLang", "darkOn", "applyLang"]),
    ("47-pullrefresh", "Pull-to-refresh", ["ptrY", "lastY"]),
    ("48-render", "Screen registry + render loop",
     ["S_trash", "SCREENS", "TABS", "render"]),
    ("49-charts", "Chart.js rendering (graceful fallback)",
     ["chartOK", "__chW", "__chM", "drawCharts"]),
    ("50-ocr", "OCR import (Tesseract)", ["ocrPick"]),
    ("51-platform", "Platform wiring: share-target intake, load hooks", []),
    ("99-boot", "Application bootstrap", []),          # trailing IIFE
]

name_of = {}
for name, title, ids in MODULES:
    for i in ids:
        assert i not in name_of, "duplicate id " + i
        name_of[i] = name

# ---------------------------------------------------------------- parse
app_path = "/tmp/work/app_body.js"
raw = open("/tmp/work/app.js", encoding="utf-8").read().split("\n")
body = "\n".join(raw[1:1268])            # drop <script> .. </script>
open(app_path, "w", encoding="utf-8").write(body)


subprocess.run(["node", "/tmp/work/parse.js", app_path, "/tmp/work/stmts.json"], check=True)
stmts = json.load(open("/tmp/work/stmts.json"))

buckets = {name: [] for name, _, _ in MODULES}
unassigned = []
OVERRIDE = [
    ("(async function boot", "99-boot"),
    ("__BUILD", "10-router"),
    ("window.addEventListener('load',()=>{try{if(db&&!locked", "51-platform"),
    ("try{const __u=new URL(location.href)", "51-platform"),
    ("try{if(false&&'serviceWorker'", "51-platform"),
]
last = None
for st in stmts:
    names = [n for n in st["names"] if n]
    text = st["text"]
    key = None
    for n in names:
        if n in name_of:
            key = name_of[n]
            break
    if key is None:
        for probe, target in OVERRIDE:
            if text.startswith(probe) or probe in text[:120]:
                key = target
                break
    if key is None:
        # anonymous statement -> belongs with the declaration it follows
        if last is None:
            unassigned.append((st["type"], text[:90]))
            continue
        key = last
    buckets[key].append(text)
    last = key

if unassigned:
    print("!! unassigned statements:")
    for t, txt in unassigned:
        print("   ", t, "|", txt.replace("\n", " ")[:90])

# ---------------------------------------------------------------- emit
BANNER = """/* =====================================================================
 * Daftari · {fname}
 * ---------------------------------------------------------------------
 * {title}
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
"""

# strip the original "/* ===== section ===== */" banner comments from statements
banner_re = re.compile(r"^\s*/\*\s*=+\s*[^=]*?\s*=+\s*\*/\s*", re.M)

written = []
for name, title, _ in MODULES:
    parts = buckets[name]
    if not parts:
        print("!! empty module:", name)
        continue
    code = "\n".join(parts)
    code = banner_re.sub("", code)
    path = os.path.join(JSDIR, name + ".js")
    open(path, "w", encoding="utf-8").write(BANNER.format(fname=name + ".js", title=title) + code + "\n")
    written.append((name, len(code.split("\n"))))

print()
for n, l in written:
    print("  %-24s %4d lines" % (n, l))
print("  %-24s %4d modules" % ("TOTAL", len(written)))

# ---------------------------------------------------------------- verify
# write the reassembled bundle and compare TOKEN STREAMS against the original
joined = "\n".join("\n".join(buckets[n]) for n, _, _ in MODULES)
open("/tmp/work/rebuilt.js", "w", encoding="utf-8").write(joined)

import subprocess
subprocess.run(["node", "/tmp/work/tokens.js", app_path, "/tmp/work/tok_orig.txt"], check=True)
subprocess.run(["node", "/tmp/work/tokens.js", "/tmp/work/rebuilt.js", "/tmp/work/tok_new.txt"], check=True)
to = open("/tmp/work/tok_orig.txt", encoding="utf-8").read().split("\n")
tn = open("/tmp/work/tok_new.txt", encoding="utf-8").read().split("\n")
print()
print("original statements :", len(stmts))
print("emitted modules     :", len(written))
print("original tokens     :", len(to))
print("modular tokens      :", len(tn))
print("TOKEN STREAM IDENTICAL :", to == tn)
if to != tn:
    import difflib
    for l in list(difflib.unified_diff(to, tn, "orig", "new", lineterm=""))[:40]:
        print(l)
