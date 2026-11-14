# QuickBill Pro — Enterprise Dynamic Invoice & Receipt Billing System

![HTML5](https://img.shields.io/badge/HTML5-Semantic_Markup-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Design_Tokens_%26_Print_CSS-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Pure_Vanilla_ES6%2B-F7DF1E?logo=javascript&logoColor=000)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero_(100%25_Browser_Native)-047857)

**QuickBill Pro** is an enterprise-grade, zero-dependency **Dynamic Invoice & POS Receipt Billing System** inspired by modern FinTech interfaces such as **Stripe Billing**, **Square Invoices**, and **QuickBooks**.

Built strictly on a **3-File Vanilla Architecture** (`index.html`, `style.css`, `script.js`), it runs instantaneously offline or online by simply opening `index.html` in any modern web browser—with zero npm packages, build steps, or external CDNs.

---

## ✨ Key Architectural & Engineering Pillars

### 1. Strict 3-File Separation of Concerns
* **`index.html`** — Pure semantic HTML5 skeleton with accessible `aria-*` roles and labels. **Zero inline CSS (`style=""`)** and **zero inline JavaScript (`onclick=""`)**.
* **`style.css`** — Centralized FinTech visual system powered by `:root` CSS custom properties, asymmetric dual-column split workspace grid, tabular numerals (`font-variant-numeric: tabular-nums`), zebra-striped table rows, distinct crimson trash-button hover states, responsive tablet/mobile layouts, and an isolated `@media print` PDF engine.
* **`script.js`** — Pure Vanilla ECMAScript implementing unidirectional data flow, safe `localStorage` persistence, event delegation, and functional `Array.prototype.reduce()` tally arithmetic.

### 2. Unidirectional State-Driven Rendering (Single Source of Truth)
QuickBill Pro never scrapes numbers from DOM cells (`td.innerText` is strictly prohibited). All mutations happen inside a centralized in-memory JavaScript state store (`items = [{ id, name, qty, price, lineTotal }]` inside `appState`):

```text
User Input ──► Validation & parseFloat() Casting ──► JS State Array ──► Pure Render Functions ──► DOM Mirror
```

### 3. The 4-Step Execution Pipeline
1. **Step 1 — Form Validation & Type Casting:** Trims text inputs, verifies positive numeric quantities and prices, and casts raw HTML input strings immediately via `parseFloat()` to prevent string-concatenation invoicing bugs (`"2" + "50" = "250"`).
2. **Step 2 — Immutable State Push:** Generates unique monotonic `Date.now()` IDs and pushes `{ id, name, qty, price, lineTotal }` records into `items`.
3. **Step 3 — Dynamic Re-Render & Event Delegation:** Regenerates `<tbody>` cleanly from state and uses a **single delegated listener** on `#invoice-tbody` to handle both row deletions (`items.filter()`) and inline cell edits.
4. **Step 4 — Functional `Array.reduce()` Financial Math:** Computes Subtotal, Percentage/Flat Discounts, Tax/GST (including optional 50/50 **CGST + SGST** split), Grand Total, and **Amount in Words** (supporting both Indian Lakh/Crore and International Million/Billion numbering) with zero imperative `for` loops.

### 4. Zero-Library PDF & Thermal Receipt Export (`@media print`)
Clicking **Print / Save PDF** (`Ctrl/Cmd + P`) invokes `window.print()`. The dedicated `@media print` stylesheet automatically strips all dashboard controls (`.no-print`, `.input-form`, `.action-btns`, `.delete-col`), removes card shadows and borders, converts inline inputs into crisp typographic ink, and outputs a clean **A4 Tax Invoice** or **80mm Thermal POS Receipt**.

---

## 🚀 Pro-Level FinTech Features (`[F1 – F8]`)

| ID | Feature | Description |
| :--- | :--- | :--- |
| **F1** | **LocalStorage Auto-Save & History Drawer** | Automatically saves the active workspace draft on every edit and provides a searchable slide-over **Invoice History** drawer to **Load**, **Duplicate**, or **Delete** archived bills. |
| **F2** | **Quick-Select Service & Product Catalog** | 1-click preset chips + `<datalist>` autocomplete auto-fill Item Name & Unit Price. Users can also save custom items directly into the catalog (`+ Save Current as Preset`). |
| **F3** | **Inline Table Row Editing** | Click any **Quantity** or **Unit Price** cell directly inside the live preview table to adjust figures in real time via delegated `input`/`change` listeners. |
| **F4** | **Custom GST/Tax, Discounts & Multi-Currency** | Switch seamlessly across **₹ INR**, **$ USD**, **€ EUR**, and **£ GBP** with locale-aware formatting, customizable Tax `%`, **CGST + SGST (50/50)** split toggle, and **Percentage (`%`) / Flat** discounts. |
| **F5** | **Persistent Seller Profile & Status Badges** | Customize merchant branding (Business Name, Email, Phone, GSTIN/Tax ID, Address, Payment Terms) persisted across sessions, paired with dynamic **Paid**, **Pending**, **Overdue**, and **Draft** status badges. |
| **F6** | **Keyboard-First "Speed Cashier" Mode** | Press `Enter` to chain seamlessly across `Item Name` $\rightarrow$ `Quantity` $\rightarrow$ `Unit Price` $\rightarrow$ `Add Item` without touching the mouse. |
| **F7** | **Dual Print Mode (`A4` vs `80mm Receipt`)** | Toggle instantly between a full corporate **A4 Tax Invoice** and a compact **80mm POS Thermal Receipt** complete with dashed dividers and receipt styling. |
| **F8** | **Zero-Library CSV Export & Demo Seeder** | Export RFC-4180 compliant accounting `.csv` spreadsheets via native `Blob` URLs, or click **Load Demo** to populate a complete multi-item enterprise invoice in one click. |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Enter` *(in Item Form)* | Step across `Description` $\rightarrow$ `Qty` $\rightarrow$ `Unit Price` $\rightarrow$ Add Item & refocus |
| `Alt + N` | Start a fresh **New Bill** draft (auto-increments Invoice #) |
| `Alt + S` | Archive current invoice snapshot to **History** |
| `Alt + H` | Toggle the **Saved Invoice History** slide-over drawer |
| `Alt + D` | Populate the **Sample Enterprise Invoice** |
| `Ctrl / Cmd + P` | Open native **Print / Save as PDF** dialog |
| `Escape` | Close History drawer or dismiss validation banner |

---

## 📂 Project Structure

```text
Quick-Bill/
├── index.html          # Strict semantic HTML5 skeleton (zero inline CSS/JS)
├── style.css           # FinTech design tokens, split grid, responsive & @media print rules
├── script.js           # Pure Vanilla ES6+ state store, event delegation & reduce() math
├── QuickBill-Pro.zip   # Ready-to-share standalone bundle of the 3-file application
└── README.md           # System architecture & usage documentation
```

---

## ⚡ Zero-Installation Quick Start

1. Clone or download this repository (or extract `QuickBill-Pro.zip`).
2. Double-click **`index.html`** to launch immediately in Chrome, Edge, Firefox, or Safari—or serve locally:
   ```bash
   python3 -m http.server 8080
   ```
3. Add line items, customize GST/discounts, and click **Print / Save PDF** (choose *"Save as PDF"* in the browser print dialog).
