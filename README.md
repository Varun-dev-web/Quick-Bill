# QuickBill

QuickBill is a browser-based invoice and receipt editor for preparing, printing, and saving small-business billing documents. It runs without a build step or external dependencies.

## Overview

Edit invoice details in a control panel and review the document as it updates. Drafts, seller details, saved catalog items, and invoice snapshots are stored locally in the browser; no data is sent to a server.

## Features

- Add, edit, and remove invoice line items; calculate subtotal, discount, tax, and total.
- A4 invoice and 80 mm receipt layouts, with browser print and Save as PDF support.
- INR, USD, EUR, and GBP formatting; optional CGST/SGST split and percentage or flat discounts.
- Editable seller, customer, invoice, date, and payment-term details.
- Saved item catalog and searchable invoice history, including load, duplicate, and delete actions.
- CSV export, sample invoice, keyboard shortcuts, and automatic draft persistence.

## Technology

- Semantic HTML
- CSS, including responsive layouts and print rules
- Vanilla JavaScript and browser APIs (`localStorage`, `Intl`, `Blob`, and `window.print`)

No package manager, framework, build tools, or external assets are required.

## Project structure

```text
PROJECT/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Setup

1. Keep the four files in the same directory.
2. Open `index.html` in a current browser, or serve the directory locally. For example:

   ```bash
   python3 -m http.server 8000
   ```

3. Visit `http://localhost:8000`.

A local web server is recommended because browser storage behavior for `file://` URLs varies. No configuration or installation is otherwise needed.

## Usage

- Add an item from the left panel or choose one from the quick catalog. Quantity and unit price can also be edited in the preview table.
- Update invoice, customer, seller, currency, tax, discount, and payment-term fields. The document and totals refresh as you edit.
- Use **Save** to archive an invoice snapshot. Open **History** to search, load, duplicate, or delete snapshots.
- Use **CSV** to download line items and totals. Use **Print / PDF** and choose a printer or Save as PDF in the browser dialog.
- Choose **A4** or **Receipt** before printing. Tax calculations are arithmetic aids; confirm applicable tax rules and invoice requirements for your jurisdiction.

Keyboard shortcuts: `Enter` moves through the item-entry fields and adds the item; `Alt+N` starts a new invoice; `Alt+S` saves to history; `Alt+H` opens history; `Alt+D` loads the sample invoice; `Esc` closes history or clears item-entry validation.

## Storage and privacy

QuickBill stores the current draft, seller profile, catalog, and invoice history in browser `localStorage` for the current browser origin. Clearing that browser's site data removes these records. CSV downloads and printed documents are created on demand and are not uploaded.

## Troubleshooting

- **Drafts do not persist:** allow site storage for the browser, then open QuickBill from the same origin each time. Private browsing and `file://` storage can behave differently across browsers.
- **Print layout is clipped:** choose the matching paper size in the print dialog, disable browser headers and footers if desired, and check the preview before printing. Receipt output depends on the printer's paper-size settings.
- **CSV is not downloaded:** allow downloads for the page and check the browser's download list.
