/* ==========================================================================
   QuickBill Pro — Pure Vanilla ECMAScript State & Rendering Engine
   Architecture: Unidirectional Single Source of Truth (Zero DOM State Scraping)
   Zero External Libraries • Event Delegation • Functional Array.reduce() Math
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Constants, Currency Definitions & Default Profiles
     ------------------------------------------------------------------------ */

  const STORAGE_KEYS = {
    DRAFT: 'quickbill_pro_active_draft_v1',
    SELLER: 'quickbill_pro_seller_profile_v1',
    CATALOG: 'quickbill_pro_preset_catalog_v1',
    HISTORY: 'quickbill_pro_invoice_history_v1',
    SEQUENCE: 'quickbill_pro_inv_sequence_v1'
  };

  const CURRENCIES = {
    INR: {
      code: 'INR',
      symbol: '₹',
      locale: 'en-IN',
      majorUnit: 'Indian Rupees',
      minorUnit: 'Paise'
    },
    USD: {
      code: 'USD',
      symbol: '$',
      locale: 'en-US',
      majorUnit: 'US Dollars',
      minorUnit: 'Cents'
    },
    EUR: {
      code: 'EUR',
      symbol: '€',
      locale: 'en-IE',
      majorUnit: 'Euros',
      minorUnit: 'Cents'
    },
    GBP: {
      code: 'GBP',
      symbol: '£',
      locale: 'en-GB',
      majorUnit: 'British Pounds',
      minorUnit: 'Pence'
    }
  };

  const DEFAULT_SELLER = {
    businessName: 'QuickBill Studio Pvt. Ltd.',
    email: 'billing@quickbill.pro',
    phone: '+91 98400 42100',
    taxId: '33AABCU9603R1ZM',
    address: 'Suite 402, FinTech Tower, OMR\nChennai, Tamil Nadu 600096'
  };

  const DEFAULT_CATALOG = [
    { id: 'preset-1', name: 'Enterprise UI/UX Architecture Audit', price: 18500, isDefault: true },
    { id: 'preset-2', name: 'Frontend Design System Implementation', price: 32000, isDefault: true },
    { id: 'preset-3', name: 'Payment Gateway & Webhook Integration', price: 14500, isDefault: true },
    { id: 'preset-4', name: 'Cloud SSL & Edge Deployment Setup', price: 6500, isDefault: true },
    { id: 'preset-5', name: 'Monthly Priority Engineering Retainer', price: 12000, isDefault: true }
  ];

  /* ------------------------------------------------------------------------
     2. Pure Utility Functions (Precision Math, Dates, Formatting & Escaping)
     ------------------------------------------------------------------------ */

  const roundCurrency = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  let lastGeneratedId = 0;
  const generateUniqueId = () => {
    const now = Date.now();
    lastGeneratedId = now > lastGeneratedId ? now : lastGeneratedId + 1;
    return lastGeneratedId;
  };

  const getTodayIso = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFutureIso = (daysAhead = 14) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (isoString) => {
    if (!isoString) return '—';
    const parts = isoString.split('-');
    if (parts.length !== 3) return isoString;
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (Number.isNaN(dateObj.getTime())) return isoString;
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const escapeHtml = (raw) =>
    String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const safeStorageGet = (key, fallbackValue) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallbackValue;
    } catch (_err) {
      return fallbackValue;
    }
  };

  const safeStorageSet = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_err) {
      return false;
    }
  };

  /* ------------------------------------------------------------------------
     3. Pure Functional Number-to-Words Converter (INR Lakh/Crore & Intl)
     ------------------------------------------------------------------------ */

  const ONES_WORDS = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const TENS_WORDS = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const convertBelowThousand = (num) => {
    if (num === 0) return '';
    if (num < 20) return ONES_WORDS[num];
    if (num < 100) {
      const rem = num % 10;
      return `${TENS_WORDS[Math.floor(num / 10)]}${rem ? ` ${ONES_WORDS[rem]}` : ''}`;
    }
    const rem = num % 100;
    return `${ONES_WORDS[Math.floor(num / 100)]} Hundred${rem ? ` ${convertBelowThousand(rem)}` : ''}`;
  };

  const convertIntegerIndian = (num) => {
    if (num === 0) return 'Zero';
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = num % 1000;

    return [
      crore > 0 ? `${convertIntegerIndian(crore)} Crore` : '',
      lakh > 0 ? `${convertBelowThousand(lakh)} Lakh` : '',
      thousand > 0 ? `${convertBelowThousand(thousand)} Thousand` : '',
      remainder > 0 ? convertBelowThousand(remainder) : ''
    ]
      .filter(Boolean)
      .join(' ');
  };

  const convertIntegerInternational = (num) => {
    if (num === 0) return 'Zero';
    const billion = Math.floor(num / 1000000000);
    const million = Math.floor((num % 1000000000) / 1000000);
    const thousand = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    return [
      billion > 0 ? `${convertBelowThousand(billion)} Billion` : '',
      million > 0 ? `${convertBelowThousand(million)} Million` : '',
      thousand > 0 ? `${convertBelowThousand(thousand)} Thousand` : '',
      remainder > 0 ? convertBelowThousand(remainder) : ''
    ]
      .filter(Boolean)
      .join(' ');
  };

  const amountToWords = (amount, currencyCode) => {
    const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
    const safeAmount = Math.max(0, roundCurrency(amount));
    if (safeAmount === 0) {
      return `${currency.majorUnit} Zero Only`;
    }
    if (safeAmount >= 99999999999) {
      return `${currency.symbol}${safeAmount.toFixed(2)} Only`;
    }

    const wholePart = Math.floor(safeAmount);
    const fractionPart = Math.round((safeAmount - wholePart) * 100);
    const converter = currencyCode === 'INR' ? convertIntegerIndian : convertIntegerInternational;

    const majorWords = `${currency.majorUnit} ${converter(wholePart)}`;
    const minorWords = fractionPart > 0
      ? ` and ${convertBelowThousand(fractionPart)} ${currency.minorUnit}`
      : '';

    return `${majorWords}${minorWords} Only`;
  };

  /* ------------------------------------------------------------------------
     4. Single Source of Truth State Store (`items` + `appState`)
     ------------------------------------------------------------------------ */

  let items = [];
  let lastAddedItemId = null;

  const generateNextInvoiceNumber = (increment = false) => {
    const currentSeq = Number(safeStorageGet(STORAGE_KEYS.SEQUENCE, 1)) || 1;
    const nextSeq = increment ? currentSeq + 1 : currentSeq;
    if (increment) {
      safeStorageSet(STORAGE_KEYS.SEQUENCE, nextSeq);
    }
    const year = new Date().getFullYear();
    return `INV-${year}-${String(nextSeq).padStart(3, '0')}`;
  };

  const appState = {
    items,
    meta: {
      invoiceNumber: generateNextInvoiceNumber(false),
      issueDate: getTodayIso(),
      dueDate: getFutureIso(14),
      status: 'PENDING',
      documentMode: 'A4',
      notes: 'Payment due within 14 days via NEFT/IMPS, Wire Transfer, or Corporate Card. Please quote the Invoice # on remittance.'
    },
    seller: { ...DEFAULT_SELLER },
    customer: {
      name: '',
      contact: '',
      taxId: '',
      address: ''
    },
    config: {
      currencyCode: 'INR',
      taxRate: 18,
      splitGst: false,
      discountType: 'PERCENT',
      discountValue: 0
    },
    catalog: [...DEFAULT_CATALOG],
    history: []
  };

  const setItems = (nextItems) => {
    items = nextItems;
    appState.items = items;
  };

  const formatCurrency = (amount, overrideCurrencyCode) => {
    const code = overrideCurrencyCode || appState.config.currencyCode;
    const currency = CURRENCIES[code] || CURRENCIES.INR;
    const numeric = roundCurrency(Number(amount) || 0);
    try {
      const formattedNumber = new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(numeric));
      return `${numeric < 0 ? '-' : ''}${currency.symbol}${formattedNumber}`;
    } catch (_err) {
      return `${numeric < 0 ? '-' : ''}${currency.symbol}${Math.abs(numeric).toFixed(2)}`;
    }
  };

  /* ------------------------------------------------------------------------
     5. Cached DOM References
     ------------------------------------------------------------------------ */

  const dom = {
    // Topbar & Mode Switch
    autosaveIndicator: document.getElementById('autosave-indicator'),
    modeA4Btn: document.getElementById('mode-a4-btn'),
    modeReceiptBtn: document.getElementById('mode-receipt-btn'),
    loadDemoBtn: document.getElementById('load-demo-btn'),
    newInvoiceBtn: document.getElementById('new-invoice-btn'),
    saveHistoryBtn: document.getElementById('save-history-btn'),
    openHistoryBtn: document.getElementById('open-history-btn'),
    historyCountBadge: document.getElementById('history-count-badge'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    printInvoiceBtn: document.getElementById('print-invoice-btn'),

    // Step 1: Item Form & Catalog
    catalogChips: document.getElementById('catalog-chips'),
    catalogDatalist: document.getElementById('catalog-datalist'),
    savePresetBtn: document.getElementById('save-preset-btn'),
    itemForm: document.getElementById('item-entry-form'),
    itemNameInput: document.getElementById('item-name-input'),
    itemQtyInput: document.getElementById('item-qty-input'),
    itemPriceInput: document.getElementById('item-price-input'),
    entryCurrencyPrefix: document.getElementById('entry-currency-prefix'),
    formErrorBanner: document.getElementById('form-error-banner'),
    clearItemsBtn: document.getElementById('clear-items-btn'),

    // Step 2: Customer & Meta Inputs
    metaInvoiceNumber: document.getElementById('meta-invoice-number'),
    metaStatus: document.getElementById('meta-status'),
    metaIssueDate: document.getElementById('meta-issue-date'),
    metaDueDate: document.getElementById('meta-due-date'),
    customerName: document.getElementById('customer-name'),
    customerContact: document.getElementById('customer-contact'),
    customerTaxId: document.getElementById('customer-tax-id'),
    customerAddress: document.getElementById('customer-address'),

    // Step 3: Financial Config Inputs
    configCurrency: document.getElementById('config-currency'),
    configTaxRate: document.getElementById('config-tax-rate'),
    configSplitGst: document.getElementById('config-split-gst'),
    configDiscountType: document.getElementById('config-discount-type'),
    configDiscountValue: document.getElementById('config-discount-value'),

    // Step 4: Seller Profile Inputs
    sellerName: document.getElementById('seller-name'),
    sellerEmail: document.getElementById('seller-email'),
    sellerPhone: document.getElementById('seller-phone'),
    sellerTaxId: document.getElementById('seller-tax-id'),
    sellerAddress: document.getElementById('seller-address'),
    metaNotes: document.getElementById('meta-notes'),
    resetSellerBtn: document.getElementById('reset-seller-btn'),

    // Live Preview Document Nodes
    previewStage: document.getElementById('preview-stage'),
    stageModeLabel: document.getElementById('stage-mode-label'),
    stageItemCounter: document.getElementById('stage-item-counter'),
    invoiceCard: document.getElementById('invoice-card'),
    previewSellerName: document.getElementById('preview-seller-name'),
    previewSellerAddress: document.getElementById('preview-seller-address'),
    previewSellerContact: document.getElementById('preview-seller-contact'),
    previewSellerTax: document.getElementById('preview-seller-tax'),
    previewDocType: document.getElementById('preview-doc-type'),
    previewInvoiceNumber: document.getElementById('preview-invoice-number'),
    previewStatusBadge: document.getElementById('preview-status-badge'),
    previewCustomerName: document.getElementById('preview-customer-name'),
    previewCustomerAddress: document.getElementById('preview-customer-address'),
    previewCustomerContact: document.getElementById('preview-customer-contact'),
    previewCustomerTax: document.getElementById('preview-customer-tax'),
    previewIssueDate: document.getElementById('preview-issue-date'),
    previewDueDateRow: document.getElementById('preview-due-date-row'),
    previewDueDate: document.getElementById('preview-due-date'),
    previewCurrencyBadge: document.getElementById('preview-currency-badge'),
    tbody: document.getElementById('invoice-tbody'),

    // Totals & Summary Nodes
    summaryQtyCount: document.getElementById('summary-qty-count'),
    subtotalAmount: document.getElementById('subtotal-amount'),
    discountRow: document.getElementById('discount-row'),
    discountLabel: document.getElementById('discount-label'),
    discountAmount: document.getElementById('discount-amount'),
    taxSingleRow: document.getElementById('tax-single-row'),
    taxLabel: document.getElementById('tax-label'),
    taxAmount: document.getElementById('tax-amount'),
    taxCgstRow: document.getElementById('tax-cgst-row'),
    cgstLabel: document.getElementById('cgst-label'),
    cgstAmount: document.getElementById('cgst-amount'),
    taxSgstRow: document.getElementById('tax-sgst-row'),
    sgstLabel: document.getElementById('sgst-label'),
    sgstAmount: document.getElementById('sgst-amount'),
    grandTotalCurrencyTag: document.getElementById('grand-total-currency-tag'),
    grandTotal: document.getElementById('grand-total'),
    previewAmountWords: document.getElementById('preview-amount-words'),
    previewNotes: document.getElementById('preview-notes'),

    // Mobile Bar
    mobileGrandTotal: document.getElementById('mobile-grand-total'),
    jumpPreviewBtn: document.getElementById('jump-preview-btn'),
    mobilePrintBtn: document.getElementById('mobile-print-btn'),

    // History Drawer & Toast
    historyBackdrop: document.getElementById('history-backdrop'),
    historyDrawer: document.getElementById('history-drawer'),
    closeHistoryBtn: document.getElementById('close-history-btn'),
    historySearchInput: document.getElementById('history-search-input'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    historyList: document.getElementById('history-list'),
    toastContainer: document.getElementById('toast-container')
  };

  /* ------------------------------------------------------------------------
     6. Persistence & Toast Notification Helpers
     ------------------------------------------------------------------------ */

  const showToast = (message, variant = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2800);
  };

  const persistWorkspace = () => {
    const draftPayload = {
      items: appState.items,
      meta: appState.meta,
      customer: appState.customer,
      config: appState.config
    };
    const savedOk = safeStorageSet(STORAGE_KEYS.DRAFT, draftPayload);
    safeStorageSet(STORAGE_KEYS.SELLER, appState.seller);
    safeStorageSet(STORAGE_KEYS.CATALOG, appState.catalog);
    safeStorageSet(STORAGE_KEYS.HISTORY, appState.history);

    const timeStamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    dom.autosaveIndicator.textContent = savedOk
      ? `Auto-saved • ${timeStamp}`
      : `In-Memory Mode • ${timeStamp}`;
  };

  /* ------------------------------------------------------------------------
     7. Core Calculation Pipeline (Step 4: Pure Array.reduce() Math)
     ------------------------------------------------------------------------ */

  const computeFinancialSummary = () => {
    // Strictly functional Array.prototype.reduce() — zero imperative loops
    const subtotal = roundCurrency(
      items.reduce((sum, item) => sum + item.lineTotal, 0)
    );
    const totalUnits = roundCurrency(
      items.reduce((sum, item) => sum + item.qty, 0)
    );

    const rawDiscountVal = Math.max(0, parseFloat(appState.config.discountValue) || 0);
    const discountAmount = appState.config.discountType === 'PERCENT'
      ? roundCurrency(subtotal * (Math.min(100, rawDiscountVal) / 100))
      : roundCurrency(Math.min(subtotal, rawDiscountVal));

    const taxableBase = roundCurrency(Math.max(0, subtotal - discountAmount));
    const safeTaxRate = Math.max(0, Math.min(100, parseFloat(appState.config.taxRate) || 0));

    let cgstAmount = 0;
    let sgstAmount = 0;
    let taxAmount = 0;

    if (appState.config.splitGst) {
      const halfRate = safeTaxRate / 2;
      cgstAmount = roundCurrency(taxableBase * (halfRate / 100));
      sgstAmount = roundCurrency(taxableBase * (halfRate / 100));
      taxAmount = roundCurrency(cgstAmount + sgstAmount);
    } else {
      taxAmount = roundCurrency(taxableBase * (safeTaxRate / 100));
    }

    const grandTotal = roundCurrency(taxableBase + taxAmount);

    return {
      subtotal,
      totalUnits,
      discountAmount,
      rawDiscountVal,
      taxableBase,
      safeTaxRate,
      cgstAmount,
      sgstAmount,
      taxAmount,
      grandTotal
    };
  };

  const updateTotals = () => {
    const summary = computeFinancialSummary();
    const currency = CURRENCIES[appState.config.currencyCode] || CURRENCIES.INR;

    dom.summaryQtyCount.textContent = String(summary.totalUnits);
    dom.subtotalAmount.textContent = formatCurrency(summary.subtotal);

    // Discount display row
    if (summary.discountAmount > 0) {
      dom.discountRow.hidden = false;
      const discountDescriptor = appState.config.discountType === 'PERCENT'
        ? `Discount (${Math.min(100, summary.rawDiscountVal)}%)`
        : 'Discount (Flat)';
      dom.discountLabel.textContent = discountDescriptor;
      dom.discountAmount.textContent = `-${formatCurrency(summary.discountAmount)}`;
    } else {
      dom.discountRow.hidden = true;
    }

    // Tax / Split GST rows
    if (appState.config.splitGst) {
      const halfRateText = Number((summary.safeTaxRate / 2).toFixed(2));
      dom.taxSingleRow.hidden = true;
      dom.taxCgstRow.hidden = false;
      dom.taxSgstRow.hidden = false;
      dom.cgstLabel.textContent = `CGST (${halfRateText}%)`;
      dom.sgstLabel.textContent = `SGST (${halfRateText}%)`;
      dom.cgstAmount.textContent = formatCurrency(summary.cgstAmount);
      dom.sgstAmount.textContent = formatCurrency(summary.sgstAmount);
    } else {
      const rateText = Number(summary.safeTaxRate.toFixed(2));
      dom.taxSingleRow.hidden = false;
      dom.taxCgstRow.hidden = true;
      dom.taxSgstRow.hidden = true;
      dom.taxLabel.textContent = `GST / Tax (${rateText}%)`;
      dom.taxAmount.textContent = formatCurrency(summary.taxAmount);
    }

    // Grand Total & Words
    const formattedGrandTotal = formatCurrency(summary.grandTotal);
    dom.grandTotalCurrencyTag.textContent = currency.code;
    dom.grandTotal.textContent = formattedGrandTotal;
    dom.mobileGrandTotal.textContent = formattedGrandTotal;
    dom.previewAmountWords.textContent = amountToWords(summary.grandTotal, currency.code);

    // Stage item counter
    const count = items.length;
    dom.stageItemCounter.textContent = `${count} Line ${count === 1 ? 'Item' : 'Items'}`;

    return summary;
  };

  /* ------------------------------------------------------------------------
     8. Pure DOM Render Functions (Step 3: State -> DOM Mirror)
     ------------------------------------------------------------------------ */

  const renderTable = () => {
    dom.tbody.innerHTML = '';

    if (items.length === 0) {
      dom.tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state-box">
              <span class="empty-state-title">No billable line items added yet</span>
              <span class="empty-state-sub">Enter an item on the left console, click a Quick-Select Catalog preset, or click "Load Demo" in the top bar.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const rowsMarkup = items
      .map((item, index) => {
        const highlightClass = item.id === lastAddedItemId ? ' class="row-just-added"' : '';
        const safeName = escapeHtml(item.name);
        return `
          <tr data-id="${item.id}"${highlightClass}>
            <td class="col-index">${index + 1}</td>
            <td class="col-desc">${safeName}</td>
            <td class="col-qty num-col">
              <input
                type="number"
                class="inline-edit-input"
                data-id="${item.id}"
                data-field="qty"
                value="${item.qty}"
                min="0.01"
                step="any"
                aria-label="Quantity for ${safeName}"
              >
            </td>
            <td class="col-price num-col">
              <input
                type="number"
                class="inline-edit-input"
                data-id="${item.id}"
                data-field="price"
                value="${item.price.toFixed(2)}"
                min="0.01"
                step="0.01"
                aria-label="Unit price for ${safeName}"
              >
            </td>
            <td class="col-total num-col" data-role="line-total">${formatCurrency(item.lineTotal)}</td>
            <td class="col-action delete-col no-print">
              <button
                type="button"
                class="delete-btn"
                data-id="${item.id}"
                title="Delete line item"
                aria-label="Delete ${safeName}"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    dom.tbody.innerHTML = rowsMarkup;
    lastAddedItemId = null;
  };

  const renderDocumentMeta = () => {
    const { meta, seller, customer, config } = appState;
    const currency = CURRENCIES[config.currencyCode] || CURRENCIES.INR;

    // Document Mode (A4 vs 80mm Receipt)
    const isReceipt = meta.documentMode === 'RECEIPT';
    dom.invoiceCard.dataset.mode = meta.documentMode;
    dom.modeA4Btn.classList.toggle('is-active', !isReceipt);
    dom.modeReceiptBtn.classList.toggle('is-active', isReceipt);
    dom.previewDocType.textContent = isReceipt ? 'POS RECEIPT' : 'TAX INVOICE';
    dom.stageModeLabel.textContent = isReceipt
      ? 'Live 80mm Thermal POS Receipt Preview'
      : 'Live A4 Invoice Preview (210 × 297 mm)';

    // Seller Identity
    dom.previewSellerName.textContent = seller.businessName.trim() || 'Your Business Name';
    dom.previewSellerAddress.textContent = seller.address.trim();
    const sellerContactParts = [seller.email.trim(), seller.phone.trim()].filter(Boolean);
    dom.previewSellerContact.textContent = sellerContactParts.join(' • ');
    dom.previewSellerTax.textContent = seller.taxId.trim() ? `GSTIN / Tax ID: ${seller.taxId.trim()}` : '';

    // Invoice Number & Status Pill
    const cleanInvNo = meta.invoiceNumber.trim() || 'INV-DRAFT';
    dom.previewInvoiceNumber.textContent = cleanInvNo.startsWith('#') ? cleanInvNo : `#${cleanInvNo}`;
    dom.previewStatusBadge.dataset.status = meta.status;
    dom.previewStatusBadge.textContent = meta.status;

    // Customer ("Bill To")
    const hasClientName = customer.name.trim().length > 0;
    dom.previewCustomerName.textContent = hasClientName ? customer.name.trim() : 'Walk-in / Cash Customer';
    dom.previewCustomerName.classList.toggle('is-placeholder', !hasClientName);
    dom.previewCustomerAddress.textContent = customer.address.trim();
    dom.previewCustomerContact.textContent = customer.contact.trim();
    dom.previewCustomerTax.textContent = customer.taxId.trim() ? `Client Tax ID: ${customer.taxId.trim()}` : '';

    // Dates & Currency Badges
    dom.previewIssueDate.textContent = formatDisplayDate(meta.issueDate);
    dom.previewDueDate.textContent = formatDisplayDate(meta.dueDate);
    dom.previewDueDateRow.hidden = isReceipt && !meta.dueDate;
    dom.previewCurrencyBadge.textContent = `${currency.code} (${currency.symbol})`;
    dom.entryCurrencyPrefix.textContent = currency.symbol;

    // Footer Notes
    dom.previewNotes.textContent = meta.notes.trim() || 'Thank you for your business.';
  };

  const syncFormInputsFromState = () => {
    const { meta, seller, customer, config } = appState;

    dom.metaInvoiceNumber.value = meta.invoiceNumber;
    dom.metaStatus.value = meta.status;
    dom.metaIssueDate.value = meta.issueDate;
    dom.metaDueDate.value = meta.dueDate;
    dom.metaNotes.value = meta.notes;

    dom.customerName.value = customer.name;
    dom.customerContact.value = customer.contact;
    dom.customerTaxId.value = customer.taxId;
    dom.customerAddress.value = customer.address;

    dom.configCurrency.value = config.currencyCode;
    dom.configTaxRate.value = config.taxRate;
    dom.configSplitGst.checked = Boolean(config.splitGst);
    dom.configDiscountType.value = config.discountType;
    dom.configDiscountValue.value = config.discountValue;

    dom.sellerName.value = seller.businessName;
    dom.sellerEmail.value = seller.email;
    dom.sellerPhone.value = seller.phone;
    dom.sellerTaxId.value = seller.taxId;
    dom.sellerAddress.value = seller.address;
  };

  const renderCatalog = () => {
    const currency = CURRENCIES[appState.config.currencyCode] || CURRENCIES.INR;

    dom.catalogChips.innerHTML = appState.catalog
      .map((preset) => {
        const safeName = escapeHtml(preset.name);
        const removeButtonMarkup = preset.isDefault
          ? ''
          : `<button type="button" class="catalog-chip-remove" data-action="remove-preset" data-preset-id="${escapeHtml(preset.id)}" title="Remove preset" aria-label="Remove ${safeName}">✕</button>`;

        return `
          <div class="catalog-chip-group" role="listitem">
            <button
              type="button"
              class="catalog-chip-btn"
              data-action="select-preset"
              data-preset-id="${escapeHtml(preset.id)}"
              title="Click to autofill ${safeName}"
            >
              <span>${safeName}</span>
              <span class="catalog-chip-price">${currency.symbol}${Number(preset.price).toLocaleString(currency.locale)}</span>
            </button>
            ${removeButtonMarkup}
          </div>
        `;
      })
      .join('');

    dom.catalogDatalist.innerHTML = appState.catalog
      .map((preset) => `<option value="${escapeHtml(preset.name)}"></option>`)
      .join('');
  };

  const renderHistoryDrawer = () => {
    dom.historyCountBadge.textContent = String(appState.history.length);

    const query = dom.historySearchInput.value.trim().toLowerCase();
    const filteredHistory = appState.history.filter((entry) => {
      if (!query) return true;
      const invMatch = (entry.meta?.invoiceNumber || '').toLowerCase().includes(query);
      const clientMatch = (entry.customer?.name || 'walk-in').toLowerCase().includes(query);
      const statusMatch = (entry.meta?.status || '').toLowerCase().includes(query);
      return invMatch || clientMatch || statusMatch;
    });

    if (filteredHistory.length === 0) {
      dom.historyList.innerHTML = `
        <div class="history-empty">
          ${appState.history.length === 0
            ? 'No archived invoices yet. Click "Save" in the top bar (or press Alt+S) to store invoice snapshots here.'
            : 'No saved invoices match your search query.'}
        </div>
      `;
      return;
    }

    dom.historyList.innerHTML = filteredHistory
      .map((entry) => {
        const invNum = escapeHtml(entry.meta?.invoiceNumber || 'INV-DRAFT');
        const clientName = escapeHtml(entry.customer?.name?.trim() || 'Walk-in / Cash Customer');
        const status = escapeHtml(entry.meta?.status || 'PENDING');
        const savedDate = formatDisplayDate((entry.savedAt || '').slice(0, 10));
        const itemCount = Array.isArray(entry.items) ? entry.items.length : 0;
        const formattedTotal = formatCurrency(entry.grandTotal || 0, entry.config?.currencyCode || 'INR');

        return `
          <div class="history-card" role="listitem">
            <div class="history-card-top">
              <span class="history-inv-num tabular-num">#${invNum.replace(/^#/, '')}</span>
              <span class="status-badge" data-status="${status}">${status}</span>
            </div>
            <div class="history-client">${clientName}</div>
            <div class="history-meta-row">
              <span>${savedDate} • ${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
              <span class="history-total tabular-num">${formattedTotal}</span>
            </div>
            <div class="history-actions">
              <button type="button" class="btn btn-primary" data-history-action="load" data-history-id="${escapeHtml(entry.archiveId)}">
                Load
              </button>
              <button type="button" class="btn btn-secondary" data-history-action="duplicate" data-history-id="${escapeHtml(entry.archiveId)}">
                Duplicate
              </button>
              <button type="button" class="btn btn-danger-outline" data-history-action="delete" data-history-id="${escapeHtml(entry.archiveId)}">
                Delete
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  };

  const renderAll = () => {
    renderDocumentMeta();
    renderCatalog();
    renderTable();
    updateTotals();
    renderHistoryDrawer();
  };

  /* ------------------------------------------------------------------------
     9. Step 1 & Step 2: Form Validation, Type Casting & State Mutation
     ------------------------------------------------------------------------ */

  const clearValidationErrors = () => {
    dom.formErrorBanner.hidden = true;
    dom.formErrorBanner.textContent = '';
    dom.itemNameInput.classList.remove('is-invalid');
    dom.itemQtyInput.classList.remove('is-invalid');
    dom.itemPriceInput.classList.remove('is-invalid');
  };

  const triggerFieldValidationError = (inputElement, message) => {
    clearValidationErrors();
    dom.formErrorBanner.textContent = message;
    dom.formErrorBanner.hidden = false;
    inputElement.classList.add('is-invalid');
    inputElement.focus();
  };

  const addItem = (event) => {
    if (event) {
      event.preventDefault();
    }

    // STEP 1: Capture inputs, trim text, and strictly cast numbers via parseFloat()
    const name = dom.itemNameInput.value.trim();
    const qty = parseFloat(dom.itemQtyInput.value);
    const price = parseFloat(dom.itemPriceInput.value);

    if (!name) {
      triggerFieldValidationError(dom.itemNameInput, 'Please enter a non-empty Item or Service description.');
      return;
    }

    if (Number.isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
      triggerFieldValidationError(dom.itemQtyInput, 'Quantity must be a valid positive number greater than 0.');
      return;
    }

    if (Number.isNaN(price) || !Number.isFinite(price) || price <= 0) {
      triggerFieldValidationError(dom.itemPriceInput, 'Unit Price must be a valid positive amount greater than 0.');
      return;
    }

    clearValidationErrors();

    // STEP 2: Construct immutable item record with unique timestamp ID and push to state
    const newItem = {
      id: generateUniqueId(),
      name,
      qty: roundCurrency(qty),
      price: roundCurrency(price),
      lineTotal: roundCurrency(qty * price)
    };

    items.push(newItem);
    lastAddedItemId = newItem.id;

    // Reset entry inputs & snap focus back to Item Name for rapid keyboard billing
    dom.itemNameInput.value = '';
    dom.itemQtyInput.value = '1';
    dom.itemPriceInput.value = '';
    dom.itemNameInput.focus();

    // STEP 3 & STEP 4: Pure re-render + functional Array.reduce() totals + auto-save
    renderTable();
    updateTotals();
    persistWorkspace();
  };

  /* ------------------------------------------------------------------------
     10. Pro-Level Actions: Presets, History Archive, Demo Seeder & CSV Export
     ------------------------------------------------------------------------ */

  const saveCurrentAsPreset = () => {
    const name = dom.itemNameInput.value.trim();
    const price = parseFloat(dom.itemPriceInput.value);

    if (!name) {
      triggerFieldValidationError(dom.itemNameInput, 'Enter an Item Name first to save it into Quick Catalog.');
      return;
    }
    if (Number.isNaN(price) || !Number.isFinite(price) || price <= 0) {
      triggerFieldValidationError(dom.itemPriceInput, 'Enter a positive Unit Price first to save as a preset.');
      return;
    }

    clearValidationErrors();

    const existingIndex = appState.catalog.findIndex(
      (preset) => preset.name.toLowerCase() === name.toLowerCase()
    );

    if (existingIndex >= 0) {
      appState.catalog[existingIndex] = {
        ...appState.catalog[existingIndex],
        name,
        price: roundCurrency(price)
      };
      showToast(`Updated preset "${name}"`, 'success');
    } else {
      appState.catalog.push({
        id: `custom-${generateUniqueId()}`,
        name,
        price: roundCurrency(price),
        isDefault: false
      });
      showToast(`Saved "${name}" to Quick Catalog`, 'success');
    }

    renderCatalog();
    persistWorkspace();
  };

  const toggleHistoryDrawer = (forceOpen) => {
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : dom.historyDrawer.hidden;
    dom.historyDrawer.hidden = !shouldOpen;
    dom.historyBackdrop.hidden = !shouldOpen;
    if (shouldOpen) {
      renderHistoryDrawer();
      dom.historySearchInput.focus();
    }
  };

  const saveInvoiceToHistory = () => {
    if (items.length === 0) {
      showToast('Add at least one line item before archiving to History.', 'warning');
      return;
    }

    const summary = computeFinancialSummary();
    const invNumber = appState.meta.invoiceNumber.trim() || generateNextInvoiceNumber(false);
    appState.meta.invoiceNumber = invNumber;
    dom.metaInvoiceNumber.value = invNumber;

    const snapshot = {
      archiveId: `arch-${generateUniqueId()}`,
      savedAt: new Date().toISOString(),
      grandTotal: summary.grandTotal,
      items: items.map((item) => ({ ...item })),
      meta: { ...appState.meta },
      customer: { ...appState.customer },
      seller: { ...appState.seller },
      config: { ...appState.config }
    };

    const existingIdx = appState.history.findIndex(
      (entry) => entry.meta?.invoiceNumber === invNumber
    );

    if (existingIdx >= 0) {
      snapshot.archiveId = appState.history[existingIdx].archiveId;
      appState.history.splice(existingIdx, 1);
    }

    appState.history.unshift(snapshot);
    renderDocumentMeta();
    renderHistoryDrawer();
    persistWorkspace();
    showToast(`Saved ${invNumber} to Invoice History`, 'success');
  };

  const startNewInvoiceDraft = () => {
    setItems([]);
    appState.meta = {
      invoiceNumber: generateNextInvoiceNumber(true),
      issueDate: getTodayIso(),
      dueDate: getFutureIso(14),
      status: 'PENDING',
      documentMode: appState.meta.documentMode,
      notes: 'Payment due within 14 days via NEFT/IMPS, Wire Transfer, or Corporate Card. Please quote the Invoice # on remittance.'
    };
    appState.customer = {
      name: '',
      contact: '',
      taxId: '',
      address: ''
    };
    appState.config.discountValue = 0;

    clearValidationErrors();
    syncFormInputsFromState();
    renderAll();
    persistWorkspace();
    dom.itemNameInput.focus();
    showToast(`Started fresh draft ${appState.meta.invoiceNumber}`, 'info');
  };

  const buildSampleItems = () => [
    {
      id: generateUniqueId(),
      name: 'Enterprise Design System & UI Component Library',
      qty: 1,
      price: 45000,
      lineTotal: 45000
    },
    {
      id: generateUniqueId(),
      name: 'Real-Time Billing & GST Reconciliation Engine',
      qty: 2,
      price: 22500,
      lineTotal: 45000
    },
    {
      id: generateUniqueId(),
      name: 'Performance & Accessibility Compliance Audit (WCAG AA)',
      qty: 1,
      price: 16000,
      lineTotal: 16000
    },
    {
      id: generateUniqueId(),
      name: 'Dedicated Cloud DevOps & CI/CD Pipeline Setup',
      qty: 3,
      price: 4500,
      lineTotal: 13500
    }
  ];

  const loadDemoInvoice = (silent = false) => {
    setItems(buildSampleItems());
    appState.meta = {
      invoiceNumber: 'INV-2026-108',
      issueDate: getTodayIso(),
      dueDate: getFutureIso(14),
      status: 'PAID',
      documentMode: appState.meta.documentMode || 'A4',
      notes: 'Settled via Corporate Wire Transfer (Ref #UTR88492019). Includes 90-day post-launch architectural warranty.'
    };
    appState.customer = {
      name: 'Horizon FinServe Technologies Pvt. Ltd.',
      contact: 'finance@horizonfinserve.in • +91 80 4120 8899',
      taxId: '29AAACH7409R1Z2',
      address: '9th Floor, Prestige Tech Park, Outer Ring Road\nBengaluru, Karnataka 560103'
    };
    appState.config = {
      currencyCode: 'INR',
      taxRate: 18,
      splitGst: true,
      discountType: 'PERCENT',
      discountValue: 5
    };

    clearValidationErrors();
    syncFormInputsFromState();
    renderAll();
    persistWorkspace();

    if (!silent) {
      showToast('Loaded sample enterprise invoice (#INV-2026-108)', 'success');
    }
  };

  const toCsvCell = (value) => {
    const str = String(value ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const exportInvoiceCsv = () => {
    if (items.length === 0) {
      showToast('Add at least one item before exporting CSV.', 'warning');
      return;
    }

    const summary = computeFinancialSummary();
    const { meta, seller, customer, config } = appState;

    const csvRows = [
      ['Document Type', meta.documentMode === 'RECEIPT' ? 'POS Receipt' : 'Tax Invoice'],
      ['Invoice Number', meta.invoiceNumber],
      ['Status', meta.status],
      ['Issue Date', meta.issueDate],
      ['Due Date', meta.dueDate],
      ['Seller Name', seller.businessName],
      ['Seller Tax ID', seller.taxId],
      ['Customer Name', customer.name || 'Walk-in / Cash Customer'],
      ['Customer Tax ID', customer.taxId],
      ['Currency', config.currencyCode],
      [],
      ['Line #', 'Item / Description', 'Quantity', 'Unit Price', 'Line Total'],
      ...items.map((item, idx) => [
        idx + 1,
        item.name,
        item.qty,
        item.price.toFixed(2),
        item.lineTotal.toFixed(2)
      ]),
      [],
      ['', '', '', 'Subtotal', summary.subtotal.toFixed(2)],
      ['', '', '', 'Discount', (-summary.discountAmount).toFixed(2)],
      ...(config.splitGst
        ? [
            ['', '', '', `CGST (${(summary.safeTaxRate / 2).toFixed(2)}%)`, summary.cgstAmount.toFixed(2)],
            ['', '', '', `SGST (${(summary.safeTaxRate / 2).toFixed(2)}%)`, summary.sgstAmount.toFixed(2)]
          ]
        : [['', '', '', `GST / Tax (${summary.safeTaxRate.toFixed(2)}%)`, summary.taxAmount.toFixed(2)]]),
      ['', '', '', 'Grand Total', summary.grandTotal.toFixed(2)]
    ];

    const csvContent = '\uFEFF' + csvRows
      .map((row) => row.map(toCsvCell).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    const safeFileSlug = (meta.invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');

    downloadLink.href = objectUrl;
    downloadLink.download = `QuickBill_${safeFileSlug}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    showToast(`Exported QuickBill_${safeFileSlug}.csv`, 'success');
  };

  /* ------------------------------------------------------------------------
     11. Event Delegation & Reactive Control Listeners
     ------------------------------------------------------------------------ */

  const bindEventListeners = () => {
    // 1. Line-Item Entry Submit & Keyboard-First Chaining ([F6])
    dom.itemForm.addEventListener('submit', addItem);

    dom.itemNameInput.addEventListener('input', () => {
      dom.itemNameInput.classList.remove('is-invalid');
      const typed = dom.itemNameInput.value.trim().toLowerCase();
      const matchedPreset = appState.catalog.find(
        (preset) => preset.name.toLowerCase() === typed
      );
      if (matchedPreset && !dom.itemPriceInput.value) {
        dom.itemPriceInput.value = String(matchedPreset.price);
      }
    });

    dom.itemNameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!dom.itemNameInput.value.trim()) {
          triggerFieldValidationError(dom.itemNameInput, 'Enter an item description before continuing.');
          return;
        }
        clearValidationErrors();
        dom.itemQtyInput.focus();
        dom.itemQtyInput.select();
      }
    });

    dom.itemQtyInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const qtyVal = parseFloat(dom.itemQtyInput.value);
        if (Number.isNaN(qtyVal) || qtyVal <= 0) {
          triggerFieldValidationError(dom.itemQtyInput, 'Quantity must be greater than 0.');
          return;
        }
        clearValidationErrors();
        dom.itemPriceInput.focus();
        dom.itemPriceInput.select();
      }
    });

    dom.clearItemsBtn.addEventListener('click', () => {
      if (items.length === 0) return;
      setItems([]);
      renderTable();
      updateTotals();
      persistWorkspace();
      showToast('Cleared all line items from invoice', 'info');
    });

    // 2. Single Event Delegation Listener on <tbody> (Delete + Inline Row Editing [F3])
    dom.tbody.addEventListener('click', (event) => {
      const deleteBtn = event.target.closest('.delete-btn');
      if (!deleteBtn) return;

      const id = Number(deleteBtn.dataset.id);
      setItems(items.filter((item) => item.id !== id));
      renderTable();
      updateTotals();
      persistWorkspace();
    });

    dom.tbody.addEventListener('input', (event) => {
      const inlineInput = event.target.closest('.inline-edit-input');
      if (!inlineInput) return;

      const id = Number(inlineInput.dataset.id);
      const field = inlineInput.dataset.field;
      const parsed = parseFloat(inlineInput.value);

      if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) {
        return;
      }

      const targetItem = items.find((item) => item.id === id);
      if (!targetItem) return;

      if (field === 'qty') {
        targetItem.qty = roundCurrency(parsed);
      } else if (field === 'price') {
        targetItem.price = roundCurrency(parsed);
      }
      targetItem.lineTotal = roundCurrency(targetItem.qty * targetItem.price);

      const row = inlineInput.closest('tr');
      const lineTotalCell = row ? row.querySelector('[data-role="line-total"]') : null;
      if (lineTotalCell) {
        lineTotalCell.textContent = formatCurrency(targetItem.lineTotal);
      }

      updateTotals();
      persistWorkspace();
    });

    dom.tbody.addEventListener('change', (event) => {
      const inlineInput = event.target.closest('.inline-edit-input');
      if (!inlineInput) return;

      const parsed = parseFloat(inlineInput.value);
      if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) {
        showToast('Inline Qty and Unit Price must be positive numbers.', 'warning');
      }
      renderTable();
      updateTotals();
      persistWorkspace();
    });

    dom.tbody.addEventListener('keydown', (event) => {
      const inlineInput = event.target.closest('.inline-edit-input');
      if (!inlineInput) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        inlineInput.blur();
      }
    });

    // 3. Delegated Quick-Select Catalog Bar ([F2])
    dom.catalogChips.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      const presetId = actionBtn.dataset.presetId;

      if (action === 'select-preset') {
        const preset = appState.catalog.find((entry) => entry.id === presetId);
        if (!preset) return;
        clearValidationErrors();
        dom.itemNameInput.value = preset.name;
        dom.itemPriceInput.value = String(preset.price);
        if (!dom.itemQtyInput.value || parseFloat(dom.itemQtyInput.value) <= 0) {
          dom.itemQtyInput.value = '1';
        }
        dom.itemQtyInput.focus();
        dom.itemQtyInput.select();
      } else if (action === 'remove-preset') {
        appState.catalog = appState.catalog.filter((entry) => entry.id !== presetId);
        renderCatalog();
        persistWorkspace();
        showToast('Removed custom preset from catalog', 'info');
      }
    });

    dom.savePresetBtn.addEventListener('click', saveCurrentAsPreset);

    // 4. Customer, Seller & Metadata Live Synchronization
    const bindTextSync = (element, updater) => {
      element.addEventListener('input', () => {
        updater(element.value);
        renderDocumentMeta();
        persistWorkspace();
      });
    };

    bindTextSync(dom.metaInvoiceNumber, (val) => { appState.meta.invoiceNumber = val; });
    bindTextSync(dom.metaIssueDate, (val) => { appState.meta.issueDate = val; });
    bindTextSync(dom.metaDueDate, (val) => { appState.meta.dueDate = val; });
    bindTextSync(dom.metaNotes, (val) => { appState.meta.notes = val; });

    dom.metaStatus.addEventListener('change', () => {
      appState.meta.status = dom.metaStatus.value;
      renderDocumentMeta();
      persistWorkspace();
    });

    bindTextSync(dom.customerName, (val) => { appState.customer.name = val; });
    bindTextSync(dom.customerContact, (val) => { appState.customer.contact = val; });
    bindTextSync(dom.customerTaxId, (val) => { appState.customer.taxId = val; });
    bindTextSync(dom.customerAddress, (val) => { appState.customer.address = val; });

    bindTextSync(dom.sellerName, (val) => { appState.seller.businessName = val; });
    bindTextSync(dom.sellerEmail, (val) => { appState.seller.email = val; });
    bindTextSync(dom.sellerPhone, (val) => { appState.seller.phone = val; });
    bindTextSync(dom.sellerTaxId, (val) => { appState.seller.taxId = val; });
    bindTextSync(dom.sellerAddress, (val) => { appState.seller.address = val; });

    dom.resetSellerBtn.addEventListener('click', () => {
      appState.seller = { ...DEFAULT_SELLER };
      syncFormInputsFromState();
      renderDocumentMeta();
      persistWorkspace();
      showToast('Restored default seller profile', 'info');
    });

    // 5. Currency, Tax/GST & Discount Controls ([F4])
    dom.configCurrency.addEventListener('change', () => {
      appState.config.currencyCode = dom.configCurrency.value;
      renderDocumentMeta();
      renderCatalog();
      renderTable();
      updateTotals();
      persistWorkspace();
    });

    dom.configTaxRate.addEventListener('input', () => {
      const parsed = parseFloat(dom.configTaxRate.value);
      appState.config.taxRate = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
      updateTotals();
      persistWorkspace();
    });

    dom.configSplitGst.addEventListener('change', () => {
      appState.config.splitGst = dom.configSplitGst.checked;
      updateTotals();
      persistWorkspace();
    });

    dom.configDiscountType.addEventListener('change', () => {
      appState.config.discountType = dom.configDiscountType.value;
      updateTotals();
      persistWorkspace();
    });

    dom.configDiscountValue.addEventListener('input', () => {
      const parsed = parseFloat(dom.configDiscountValue.value);
      appState.config.discountValue = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
      updateTotals();
      persistWorkspace();
    });

    // 6. Document Layout Mode Toggle ([F7]: A4 vs 80mm Receipt)
    const setDocumentMode = (mode) => {
      appState.meta.documentMode = mode;
      renderDocumentMeta();
      persistWorkspace();
    };

    dom.modeA4Btn.addEventListener('click', () => setDocumentMode('A4'));
    dom.modeReceiptBtn.addEventListener('click', () => setDocumentMode('RECEIPT'));

    // 7. Topbar Utility Buttons & Zero-Library Print Trigger
    const triggerPrint = () => {
      window.print();
    };

    dom.printInvoiceBtn.addEventListener('click', triggerPrint);
    dom.mobilePrintBtn.addEventListener('click', triggerPrint);
    dom.jumpPreviewBtn.addEventListener('click', () => {
      dom.previewStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    dom.loadDemoBtn.addEventListener('click', () => loadDemoInvoice(false));
    dom.newInvoiceBtn.addEventListener('click', startNewInvoiceDraft);
    dom.saveHistoryBtn.addEventListener('click', saveInvoiceToHistory);
    dom.exportCsvBtn.addEventListener('click', exportInvoiceCsv);

    // 8. History Drawer & Event Delegation ([F1])
    dom.openHistoryBtn.addEventListener('click', () => toggleHistoryDrawer(true));
    dom.closeHistoryBtn.addEventListener('click', () => toggleHistoryDrawer(false));
    dom.historyBackdrop.addEventListener('click', () => toggleHistoryDrawer(false));
    dom.historySearchInput.addEventListener('input', renderHistoryDrawer);

    dom.clearHistoryBtn.addEventListener('click', () => {
      if (appState.history.length === 0) return;
      appState.history = [];
      renderHistoryDrawer();
      persistWorkspace();
      showToast('Cleared all saved invoice history', 'info');
    });

    dom.historyList.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-history-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.historyAction;
      const archiveId = actionBtn.dataset.historyId;
      const entry = appState.history.find((record) => record.archiveId === archiveId);
      if (!entry) return;

      if (action === 'load') {
        setItems((entry.items || []).map((item) => ({ ...item })));
        appState.meta = { ...appState.meta, ...entry.meta };
        appState.customer = { ...appState.customer, ...entry.customer };
        appState.config = { ...appState.config, ...entry.config };
        syncFormInputsFromState();
        renderAll();
        persistWorkspace();
        toggleHistoryDrawer(false);
        showToast(`Loaded ${appState.meta.invoiceNumber}`, 'success');
      } else if (action === 'duplicate') {
        setItems(
          (entry.items || []).map((item) => ({
            ...item,
            id: generateUniqueId()
          }))
        );
        appState.meta = {
          ...appState.meta,
          ...entry.meta,
          invoiceNumber: generateNextInvoiceNumber(true),
          issueDate: getTodayIso(),
          dueDate: getFutureIso(14),
          status: 'PENDING'
        };
        appState.customer = { ...appState.customer, ...entry.customer };
        appState.config = { ...appState.config, ...entry.config };
        syncFormInputsFromState();
        renderAll();
        persistWorkspace();
        toggleHistoryDrawer(false);
        showToast(`Duplicated as ${appState.meta.invoiceNumber}`, 'success');
      } else if (action === 'delete') {
        appState.history = appState.history.filter((record) => record.archiveId !== archiveId);
        renderHistoryDrawer();
        persistWorkspace();
        showToast('Removed invoice from history', 'info');
      }
    });

    // 9. Global Keyboard Shortcuts ([F6])
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!dom.historyDrawer.hidden) {
          toggleHistoryDrawer(false);
        } else {
          clearValidationErrors();
        }
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'n') {
          event.preventDefault();
          startNewInvoiceDraft();
        } else if (key === 's') {
          event.preventDefault();
          saveInvoiceToHistory();
        } else if (key === 'h') {
          event.preventDefault();
          toggleHistoryDrawer();
        } else if (key === 'd') {
          event.preventDefault();
          loadDemoInvoice(false);
        }
      }
    });
  };

  /* ------------------------------------------------------------------------
     12. Application Bootstrap & LocalStorage Hydration
     ------------------------------------------------------------------------ */

  const hydrateAndBootstrap = () => {
    const storedSeller = safeStorageGet(STORAGE_KEYS.SELLER, null);
    if (storedSeller && typeof storedSeller === 'object') {
      appState.seller = { ...DEFAULT_SELLER, ...storedSeller };
    }

    const storedCatalog = safeStorageGet(STORAGE_KEYS.CATALOG, null);
    if (Array.isArray(storedCatalog) && storedCatalog.length > 0) {
      appState.catalog = storedCatalog;
    }

    const storedHistory = safeStorageGet(STORAGE_KEYS.HISTORY, null);
    if (Array.isArray(storedHistory)) {
      appState.history = storedHistory;
    }

    const storedDraft = safeStorageGet(STORAGE_KEYS.DRAFT, null);
    if (storedDraft && typeof storedDraft === 'object') {
      if (Array.isArray(storedDraft.items)) {
        const sanitizedItems = storedDraft.items
          .map((rawItem) => {
            const qty = parseFloat(rawItem.qty);
            const price = parseFloat(rawItem.price);
            if (!rawItem.name || Number.isNaN(qty) || Number.isNaN(price) || qty <= 0 || price <= 0) {
              return null;
            }
            return {
              id: Number(rawItem.id) || generateUniqueId(),
              name: String(rawItem.name),
              qty: roundCurrency(qty),
              price: roundCurrency(price),
              lineTotal: roundCurrency(qty * price)
            };
          })
          .filter(Boolean);
        setItems(sanitizedItems);
      }
      if (storedDraft.meta) {
        appState.meta = { ...appState.meta, ...storedDraft.meta };
      }
      if (storedDraft.customer) {
        appState.customer = { ...appState.customer, ...storedDraft.customer };
      }
      if (storedDraft.config) {
        appState.config = { ...appState.config, ...storedDraft.config };
      }
      syncFormInputsFromState();
      renderAll();
    } else {
      // First-time launch: seed rich sample invoice so the workspace shines immediately
      loadDemoInvoice(true);
    }

    bindEventListeners();
  };

  hydrateAndBootstrap();
})();
