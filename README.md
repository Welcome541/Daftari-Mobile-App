# دَفتَري — Daftari (React + TypeScript + Vite)

An offline-first Arabic & English debt ledger rewritten from the Android WebView application (`Daftari-Mobile-App` 3.0) into a modular React + TypeScript + Vite web application while preserving all core features, ledger invariants, encryption, and exact UI styling.

## Features
- **Double-entry / Indexed Ledger**: Invoices, partial/full FIFO payment allocations, invoice edits log, returns/adjustments, overdue tracking, credit limits, opening balances, and personal expense/deposit mode.
- **Multi-Account & Multi-Currency**: Grocery and Personal accounts across regional currencies or custom currency codes with configurable minor units.
- **Arabic / English Bilingual & RTL/LTR**: Instant switching between Arabic (RTL) and English (LTR) with Arabic numeral normalization and fuzzy name/phone matching.
- **Local Persistence & Encryption**: IndexedDB (`Store`) + `localStorage` fallback with optional 4-digit PIN lock, AES-GCM-256 encrypted database storage, PBKDF2 key wrapping, WebAuthn fingerprint/biometric unlock, and auto-lock timer.
- **Voice & OCR Input**: Web Speech API (`SpeechRecognition`) voice parsing with audio bar meter, strict voice rules, manual confirmation/editing, external engine text parser, paper-ledger bulk transfer, and Tesseract.js OCR import.
- **Reports & Exports**: Day/Week/Month/Range analytics with Chart.js (and CSS fallback), XLSX export (`SheetJS`), CSV export, printable customer statements & reports (`PrintView`), QR code transfer/statements (`qrcode.js` / `jsQR.js`), Web Bluetooth thermal printing, WhatsApp/SMS reminders, backup/restore with SHA-256 integrity checks, and Trash bin with restore/purge.
- **Appearance & Theme**: Dark/Light/Auto theme, amount privacy blur toggle, interface scale (`--s`) and display density (`--density`) sliders.

## Development

```bash
npm install
npm run dev      # Vite dev server on http://0.0.0.0:3000
npm run build    # TypeScript check + production bundle
npm run lint     # TypeScript type-check (tsc --noEmit)
```
