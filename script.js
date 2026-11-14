/* QuickBill: state, calculations, local persistence and accessible interactions. */
(() => {
  'use strict';

  const STORAGE_KEYS = {
    draft: 'quickbill_pro_active_draft_v1',
    seller: 'quickbill_pro_seller_profile_v1',
    catalog: 'quickbill_pro_preset_catalog_v1',
    history: 'quickbill_pro_invoice_history_v1',
    sequence: 'quickbill_pro_inv_sequence_v1'
  };

  const CURRENCIES = {
    INR: { code: 'INR', symbol: '₹', locale: 'en-IN', major: 'Indian Rupees', minor: 'Paise' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US', major: 'US Dollars', minor: 'Cents' },
    EUR: { code: 'EUR', symbol: '€', locale: 'en-IE', major: 'Euros', minor: 'Cents' },
    GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', major: 'British Pounds', minor: 'Pence' }
  };

  const VALID_STATUSES = new Set(['PENDING', 'PAID', 'OVERDUE', 'DRAFT']);
  const DEFAULT_NOTES = 'Payment due within 14 days via bank transfer or card. Please quote the invoice number with your remittance.';
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

  const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const roundQuantity = (value) => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
  const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const asText = (value, maxLength = 320) => String(value ?? '').slice(0, maxLength);

  let lastGeneratedId = 0;
  const generateUniqueId = () => {
    const now = Date.now();
    lastGeneratedId = Math.max(now, lastGeneratedId + 1);
    return lastGeneratedId;
  };

  const safeStorageGet = (key, fallbackValue) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallbackValue : JSON.parse(raw);
    } catch (_error) {
      return fallbackValue;
    }
  };

  const safeStorageSet = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_error) {
      return false;
    }
  };

  const getTodayIso = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFutureIso = (daysAhead = 14) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

  const formatDisplayDate = (value) => {
    if (!isIsoDate(value)) return '—';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '—';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  let invoiceSequence = null;
  const getSequence = () => {
    if (invoiceSequence === null) {
      const storedSequence = Number(safeStorageGet(STORAGE_KEYS.sequence, 1));
      invoiceSequence = Number.isInteger(storedSequence) && storedSequence > 0 ? storedSequence : 1;
    }
    return invoiceSequence;
  };

  const generateNextInvoiceNumber = (increment = false) => {
    const sequence = getSequence() + (increment ? 1 : 0);
    if (increment) {
      invoiceSequence = sequence;
      safeStorageSet(STORAGE_KEYS.sequence, sequence);
    }
    return `INV-${new Date().getFullYear()}-${String(sequence).padStart(3, '0')}`;
  };

  const recordInvoiceSequence = (invoiceNumber) => {
    const match = String(invoiceNumber || '').match(/^INV-(\d{4})-(\d+)$/i);
    if (!match || Number(match[1]) !== new Date().getFullYear()) return;
    const sequence = Number(match[2]);
    if (Number.isInteger(sequence) && sequence > getSequence()) {
      invoiceSequence = sequence;
      safeStorageSet(STORAGE_KEYS.sequence, sequence);
    }
  };

  /* Amount-in-words helpers support Indian lakh/crore and international groupings. */
  const ONES_WORDS = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const TENS_WORDS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelowThousand = (number) => {
    if (!number) return '';
    if (number < 20) return ONES_WORDS[number];
    if (number < 100) {
      const remainder = number % 10;
      return `${TENS_WORDS[Math.floor(number / 10)]}${remainder ? ` ${ONES_WORDS[remainder]}` : ''}`;
    }
    const remainder = number % 100;
    return `${ONES_WORDS[Math.floor(number / 100)]} Hundred${remainder ? ` ${convertBelowThousand(remainder)}` : ''}`;
  };

  const convertIntegerIndian = (number) => {
    if (!number) return 'Zero';
    const crore = Math.floor(number / 10000000);
    const lakh = Math.floor((number % 10000000) / 100000);
    const thousand = Math.floor((number % 100000) / 1000);
    const remainder = number % 1000;
    return [
      crore ? `${convertIntegerIndian(crore)} Crore` : '',
      lakh ? `${convertBelowThousand(lakh)} Lakh` : '',
      thousand ? `${convertBelowThousand(thousand)} Thousand` : '',
      remainder ? convertBelowThousand(remainder) : ''
    ].filter(Boolean).join(' ');
  };

  const convertIntegerInternational = (number) => {
    if (!number) return 'Zero';
    const billion = Math.floor(number / 1000000000);
    const million = Math.floor((number % 1000000000) / 1000000);
    const thousand = Math.floor((number % 1000000) / 1000);
    const remainder = number % 1000;
    return [
      billion ? `${convertBelowThousand(billion)} Billion` : '',
      million ? `${convertBelowThousand(million)} Million` : '',
      thousand ? `${convertBelowThousand(thousand)} Thousand` : '',
      remainder ? convertBelowThousand(remainder) : ''
    ].filter(Boolean).join(' ');
  };

  const amountToWords = (amount, currencyCode) => {
    const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
    const value = Math.max(0, roundMoney(amount));
    if (value === 0) return `${currency.major} Zero Only`;
    if (value >= 99999999999) return `${currency.symbol}${value.toFixed(2)} Only`;

    const whole = Math.floor(value);
    const fraction = Math.round((value - whole) * 100);
    const integerWords = currencyCode === 'INR' ? convertIntegerIndian(whole) : convertIntegerInternational(whole);
    const minorWords = fraction ? ` and ${convertBelowThousand(fraction)} ${currency.minor}` : '';
    return `${currency.major} ${integerWords}${minorWords} Only`;
  };

  const appState = {
    items: [],
    meta: {
      invoiceNumber: generateNextInvoiceNumber(false),
      issueDate: getTodayIso(),
      dueDate: getFutureIso(14),
      status: 'PENDING',
      documentMode: 'A4',
      notes: DEFAULT_NOTES
    },
    seller: { ...DEFAULT_SELLER },
    customer: { name: '', contact: '', taxId: '', address: '' },
    config: { currencyCode: 'INR', taxRate: 18, splitGst: false, discountType: 'PERCENT', discountValue: 0 },
    catalog: DEFAULT_CATALOG.map((preset) => ({ ...preset })),
    history: []
  };

  let items = appState.items;
  let previousFocus = null;

  const setItems = (nextItems) => {
    items = nextItems;
    appState.items = items;
  };

  const formatCurrency = (amount, currencyCode = appState.config.currencyCode) => {
    const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
    const numeric = roundMoney(toFiniteNumber(amount));
    try {
      const formatted = new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(numeric));
      return `${numeric < 0 ? '-' : ''}${currency.symbol}${formatted}`;
    } catch (_error) {
      return `${numeric < 0 ? '-' : ''}${currency.symbol}${Math.abs(numeric).toFixed(2)}`;
    }
  };

  const formatQuantity = (quantity) => {
    const numeric = toFiniteNumber(quantity);
    try {
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(numeric);
    } catch (_error) {
      return String(numeric);
    }
  };

  const dom = {
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

    metaInvoiceNumber: document.getElementById('meta-invoice-number'),
    metaStatus: document.getElementById('meta-status'),
    metaIssueDate: document.getElementById('meta-issue-date'),
    metaDueDate: document.getElementById('meta-due-date'),
    customerName: document.getElementById('customer-name'),
    customerContact: document.getElementById('customer-contact'),
    customerTaxId: document.getElementById('customer-tax-id'),
    customerAddress: document.getElementById('customer-address'),

    configCurrency: document.getElementById('config-currency'),
    configTaxRate: document.getElementById('config-tax-rate'),
    configSplitGst: document.getElementById('config-split-gst'),
    configDiscountType: document.getElementById('config-discount-type'),
    configDiscountValue: document.getElementById('config-discount-value'),

    sellerName: document.getElementById('seller-name'),
    sellerEmail: document.getElementById('seller-email'),
    sellerPhone: document.getElementById('seller-phone'),
    sellerTaxId: document.getElementById('seller-tax-id'),
    sellerAddress: document.getElementById('seller-address'),
    metaNotes: document.getElementById('meta-notes'),
    resetSellerBtn: document.getElementById('reset-seller-btn'),

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

    mobileGrandTotal: document.getElementById('mobile-grand-total'),
    jumpPreviewBtn: document.getElementById('jump-preview-btn'),
    mobilePrintBtn: document.getElementById('mobile-print-btn'),

    historyBackdrop: document.getElementById('history-backdrop'),
    historyDrawer: document.getElementById('history-drawer'),
    closeHistoryBtn: document.getElementById('close-history-btn'),
    historySearchInput: document.getElementById('history-search-input'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    historyList: document.getElementById('history-list'),
    toastContainer: document.getElementById('toast-container')
  };

  const showToast = (message, variant = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  };

  const persistWorkspace = () => {
    const draft = {
      items: appState.items,
      meta: appState.meta,
      customer: appState.customer,
      config: appState.config
    };
    const saved = safeStorageSet(STORAGE_KEYS.draft, draft);
    safeStorageSet(STORAGE_KEYS.seller, appState.seller);
    safeStorageSet(STORAGE_KEYS.catalog, appState.catalog);
    safeStorageSet(STORAGE_KEYS.history, appState.history);

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dom.autosaveIndicator.textContent = saved ? `Saved locally · ${time}` : 'Browser storage unavailable · not saved';
  };

  const computeFinancialSummary = () => {
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const totalUnits = roundQuantity(items.reduce((sum, item) => sum + item.qty, 0));
    const rawDiscountValue = Math.max(0, toFiniteNumber(appState.config.discountValue));
    const discountAmount = appState.config.discountType === 'PERCENT'
      ? roundMoney(subtotal * (Math.min(100, rawDiscountValue) / 100))
      : roundMoney(Math.min(subtotal, rawDiscountValue));
    const taxableBase = roundMoney(Math.max(0, subtotal - discountAmount));
    const taxRate = clamp(toFiniteNumber(appState.config.taxRate), 0, 100);

    let taxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    if (appState.config.splitGst) {
      const halfRate = taxRate / 2;
      cgstAmount = roundMoney(taxableBase * halfRate / 100);
      sgstAmount = roundMoney(taxableBase * halfRate / 100);
      taxAmount = roundMoney(cgstAmount + sgstAmount);
    } else {
      taxAmount = roundMoney(taxableBase * taxRate / 100);
    }

    return {
      subtotal,
      totalUnits,
      rawDiscountValue,
      discountAmount,
      taxableBase,
      taxRate,
      cgstAmount,
      sgstAmount,
      taxAmount,
      grandTotal: roundMoney(taxableBase + taxAmount)
    };
  };

  const updateTotals = () => {
    const summary = computeFinancialSummary();
    const currency = CURRENCIES[appState.config.currencyCode] || CURRENCIES.INR;

    dom.summaryQtyCount.textContent = formatQuantity(summary.totalUnits);
    dom.subtotalAmount.textContent = formatCurrency(summary.subtotal);

    if (summary.discountAmount > 0) {
      dom.discountRow.hidden = false;
      dom.discountLabel.textContent = appState.config.discountType === 'PERCENT'
        ? `Discount (${Math.min(100, summary.rawDiscountValue)}%)`
        : 'Discount (flat)';
      dom.discountAmount.textContent = `-${formatCurrency(summary.discountAmount)}`;
    } else {
      dom.discountRow.hidden = true;
    }

    if (appState.config.splitGst) {
      const halfRate = Number((summary.taxRate / 2).toFixed(2));
      dom.taxSingleRow.hidden = true;
      dom.taxCgstRow.hidden = false;
      dom.taxSgstRow.hidden = false;
      dom.cgstLabel.textContent = `CGST (${halfRate}%)`;
      dom.sgstLabel.textContent = `SGST (${halfRate}%)`;
      dom.cgstAmount.textContent = formatCurrency(summary.cgstAmount);
      dom.sgstAmount.textContent = formatCurrency(summary.sgstAmount);
    } else {
      dom.taxSingleRow.hidden = false;
      dom.taxCgstRow.hidden = true;
      dom.taxSgstRow.hidden = true;
      dom.taxLabel.textContent = `Tax (${Number(summary.taxRate.toFixed(2))}%)`;
      dom.taxAmount.textContent = formatCurrency(summary.taxAmount);
    }

    const total = formatCurrency(summary.grandTotal);
    dom.grandTotalCurrencyTag.textContent = currency.code;
    dom.grandTotal.textContent = total;
    dom.mobileGrandTotal.textContent = total;
    dom.previewAmountWords.textContent = amountToWords(summary.grandTotal, currency.code);
    dom.stageItemCounter.textContent = `${items.length} line ${items.length === 1 ? 'item' : 'items'}`;
    return summary;
  };

  const renderTable = () => {
    if (items.length === 0) {
      dom.tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state-box">
              <span class="empty-state-title">No line items yet</span>
              <span class="empty-state-sub">Add a description and price, or choose a saved item from the catalog.</span>
            </div>
          </td>
        </tr>`;
      return;
    }

    dom.tbody.innerHTML = items.map((item, index) => {
      const safeName = escapeHtml(item.name);
      const safeId = Number(item.id);
      return `
        <tr data-id="${safeId}">
          <td class="col-index">${index + 1}</td>
          <td class="col-desc">${safeName}</td>
          <td class="col-qty num-col">
            <input type="number" class="inline-edit-input" data-id="${safeId}" data-field="qty" value="${item.qty}" min="0.0001" step="any" inputmode="decimal" aria-label="Quantity for ${safeName}">
          </td>
          <td class="col-price num-col">
            <input type="number" class="inline-edit-input" data-id="${safeId}" data-field="price" value="${item.price.toFixed(2)}" min="0.01" step="0.01" inputmode="decimal" aria-label="Unit price for ${safeName}">
          </td>
          <td class="col-total num-col" data-role="line-total">${formatCurrency(item.lineTotal)}</td>
          <td class="col-action delete-col no-print">
            <button type="button" class="delete-btn" data-id="${safeId}" title="Remove line item" aria-label="Remove ${safeName}">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                <path d="M4 6h12M8 6V4h4v2m3 0-.7 10H5.7L5 6m3 3v4m4-4v4" />
              </svg>
            </button>
          </td>
        </tr>`;
    }).join('');
  };

  const renderDocumentMeta = () => {
    const { meta, seller, customer, config } = appState;
    const currency = CURRENCIES[config.currencyCode] || CURRENCIES.INR;
    const isReceipt = meta.documentMode === 'RECEIPT';

    dom.invoiceCard.dataset.mode = isReceipt ? 'RECEIPT' : 'A4';
    dom.modeA4Btn.classList.toggle('is-active', !isReceipt);
    dom.modeReceiptBtn.classList.toggle('is-active', isReceipt);
    dom.modeA4Btn.setAttribute('aria-pressed', String(!isReceipt));
    dom.modeReceiptBtn.setAttribute('aria-pressed', String(isReceipt));
    dom.previewDocType.textContent = isReceipt ? 'POS receipt' : 'Tax invoice';
    dom.stageModeLabel.textContent = isReceipt ? 'Live 80 mm receipt preview' : 'Live A4 invoice · 210 × 297 mm';

    dom.previewSellerName.textContent = seller.businessName.trim() || 'Your business name';
    dom.previewSellerAddress.textContent = seller.address.trim();
    dom.previewSellerContact.textContent = [seller.email.trim(), seller.phone.trim()].filter(Boolean).join(' · ');
    dom.previewSellerTax.textContent = seller.taxId.trim() ? `GSTIN / Tax ID: ${seller.taxId.trim()}` : '';

    const invoiceNumber = meta.invoiceNumber.trim() || 'INV-DRAFT';
    dom.previewInvoiceNumber.textContent = invoiceNumber.startsWith('#') ? invoiceNumber : `#${invoiceNumber}`;
    dom.previewStatusBadge.dataset.status = meta.status;
    dom.previewStatusBadge.textContent = meta.status;

    const hasCustomerName = Boolean(customer.name.trim());
    dom.previewCustomerName.textContent = hasCustomerName ? customer.name.trim() : 'Walk-in / Cash Customer';
    dom.previewCustomerName.classList.toggle('is-placeholder', !hasCustomerName);
    dom.previewCustomerAddress.textContent = customer.address.trim();
    dom.previewCustomerContact.textContent = customer.contact.trim();
    dom.previewCustomerTax.textContent = customer.taxId.trim() ? `Client Tax ID: ${customer.taxId.trim()}` : '';

    dom.previewIssueDate.textContent = formatDisplayDate(meta.issueDate);
    dom.previewDueDate.textContent = formatDisplayDate(meta.dueDate);
    dom.previewDueDateRow.hidden = isReceipt && !meta.dueDate;
    dom.previewCurrencyBadge.textContent = `${currency.code} (${currency.symbol})`;
    dom.entryCurrencyPrefix.textContent = currency.symbol;
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
    dom.configTaxRate.value = String(config.taxRate);
    dom.configSplitGst.checked = Boolean(config.splitGst);
    dom.configDiscountType.value = config.discountType;
    dom.configDiscountValue.value = String(config.discountValue);

    dom.sellerName.value = seller.businessName;
    dom.sellerEmail.value = seller.email;
    dom.sellerPhone.value = seller.phone;
    dom.sellerTaxId.value = seller.taxId;
    dom.sellerAddress.value = seller.address;
  };

  const renderCatalog = () => {
    dom.catalogChips.innerHTML = appState.catalog.map((preset) => {
      const safeName = escapeHtml(preset.name);
      const safeId = escapeHtml(preset.id);
      const removeButton = preset.isDefault ? '' : `
        <button type="button" class="catalog-chip-remove" data-action="remove-preset" data-preset-id="${safeId}" aria-label="Remove ${safeName} from catalog" title="Remove saved item">×</button>`;
      return `
        <div class="catalog-chip-group" role="listitem">
          <button type="button" class="catalog-chip-btn" data-action="select-preset" data-preset-id="${safeId}" title="Use ${safeName}">
            <span>${safeName}</span>
            <span class="catalog-chip-price">${formatCurrency(preset.price)}</span>
          </button>
          ${removeButton}
        </div>`;
    }).join('');

    dom.catalogDatalist.innerHTML = appState.catalog
      .map((preset) => `<option value="${escapeHtml(preset.name)}"></option>`)
      .join('');
  };

  const renderHistoryDrawer = () => {
    dom.historyCountBadge.textContent = String(appState.history.length);
    const query = dom.historySearchInput.value.trim().toLowerCase();
    const filtered = appState.history.filter((entry) => {
      const invoiceNumber = String(entry.meta.invoiceNumber || '').toLowerCase();
      const customerName = String(entry.customer.name || 'walk-in').toLowerCase();
      const status = String(entry.meta.status || '').toLowerCase();
      return !query || invoiceNumber.includes(query) || customerName.includes(query) || status.includes(query);
    });

    if (filtered.length === 0) {
      dom.historyList.innerHTML = `<div class="history-empty">${appState.history.length === 0
        ? 'No snapshots saved yet. Save a completed invoice to keep a copy here.'
        : 'No saved invoices match that search.'}</div>`;
      return;
    }

    dom.historyList.innerHTML = filtered.map((entry) => {
      const invoiceNumber = escapeHtml(entry.meta.invoiceNumber || 'INV-DRAFT').replace(/^#/, '');
      const customerName = escapeHtml(entry.customer.name.trim() || 'Walk-in / Cash Customer');
      const status = VALID_STATUSES.has(entry.meta.status) ? entry.meta.status : 'PENDING';
      const archiveId = escapeHtml(entry.archiveId);
      const savedDate = formatDisplayDate(String(entry.savedAt || '').slice(0, 10));
      const itemCount = entry.items.length;
      const total = formatCurrency(entry.grandTotal, entry.config.currencyCode);
      return `
        <div class="history-card" role="listitem">
          <div class="history-card-top">
            <span class="history-inv-num">#${invoiceNumber}</span>
            <span class="status-badge" data-status="${status}">${status}</span>
          </div>
          <div class="history-client">${customerName}</div>
          <div class="history-meta-row">
            <span>${savedDate} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
            <span class="history-total">${total}</span>
          </div>
          <div class="history-actions">
            <button type="button" class="btn btn-primary" data-history-action="load" data-history-id="${archiveId}">Load</button>
            <button type="button" class="btn btn-secondary" data-history-action="duplicate" data-history-id="${archiveId}">Duplicate</button>
            <button type="button" class="btn btn-outline-danger" data-history-action="delete" data-history-id="${archiveId}">Delete</button>
          </div>
        </div>`;
    }).join('');
  };

  const renderAll = () => {
    renderDocumentMeta();
    renderCatalog();
    renderTable();
    updateTotals();
    renderHistoryDrawer();
  };

  const clearValidationErrors = () => {
    dom.formErrorBanner.hidden = true;
    dom.formErrorBanner.textContent = '';
    [dom.itemNameInput, dom.itemQtyInput, dom.itemPriceInput].forEach((input) => input.removeAttribute('aria-invalid'));
  };

  const triggerFieldValidationError = (input, message) => {
    clearValidationErrors();
    dom.formErrorBanner.textContent = message;
    dom.formErrorBanner.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  };

  const addItem = (event) => {
    event.preventDefault();
    const name = dom.itemNameInput.value.trim();
    const rawQuantity = Number(dom.itemQtyInput.value);
    const rawPrice = Number(dom.itemPriceInput.value);

    if (!name) {
      triggerFieldValidationError(dom.itemNameInput, 'Enter a description before adding the line item.');
      return;
    }
    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0 || roundQuantity(rawQuantity) <= 0) {
      triggerFieldValidationError(dom.itemQtyInput, 'Quantity must be a number greater than zero.');
      return;
    }
    if (!Number.isFinite(rawPrice) || rawPrice <= 0 || roundMoney(rawPrice) <= 0) {
      triggerFieldValidationError(dom.itemPriceInput, 'Unit price must be an amount greater than zero.');
      return;
    }

    clearValidationErrors();
    const quantity = roundQuantity(rawQuantity);
    const price = roundMoney(rawPrice);
    const newItem = {
      id: generateUniqueId(),
      name: name.slice(0, 140),
      qty: quantity,
      price,
      lineTotal: roundMoney(quantity * price)
    };
    setItems([...items, newItem]);

    dom.itemNameInput.value = '';
    dom.itemQtyInput.value = '1';
    dom.itemPriceInput.value = '';
    renderTable();
    updateTotals();
    persistWorkspace();
    dom.itemNameInput.focus();
  };

  const saveCurrentAsPreset = () => {
    const name = dom.itemNameInput.value.trim();
    const rawPrice = Number(dom.itemPriceInput.value);
    if (!name) {
      triggerFieldValidationError(dom.itemNameInput, 'Enter an item description before saving it to the catalog.');
      return;
    }
    if (!Number.isFinite(rawPrice) || rawPrice <= 0 || roundMoney(rawPrice) <= 0) {
      triggerFieldValidationError(dom.itemPriceInput, 'Enter a unit price greater than zero before saving.');
      return;
    }

    clearValidationErrors();
    const price = roundMoney(rawPrice);
    const existingIndex = appState.catalog.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) {
      appState.catalog[existingIndex] = { ...appState.catalog[existingIndex], name, price };
      showToast(`Updated catalog item: ${name}`, 'success');
    } else {
      appState.catalog.push({ id: `custom-${generateUniqueId()}`, name: name.slice(0, 140), price, isDefault: false });
      showToast(`Saved to catalog: ${name}`, 'success');
    }
    renderCatalog();
    persistWorkspace();
  };

  const toggleHistoryDrawer = (forceOpen) => {
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : dom.historyDrawer.hidden;
    if (shouldOpen === !dom.historyDrawer.hidden) return;

    if (shouldOpen) {
      previousFocus = document.activeElement;
      dom.historyDrawer.hidden = false;
      dom.historyBackdrop.hidden = false;
      document.body.classList.add('drawer-open');
      dom.openHistoryBtn.setAttribute('aria-expanded', 'true');
      renderHistoryDrawer();
      dom.historySearchInput.focus();
    } else {
      dom.historyDrawer.hidden = true;
      dom.historyBackdrop.hidden = true;
      document.body.classList.remove('drawer-open');
      dom.openHistoryBtn.setAttribute('aria-expanded', 'false');
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      else dom.openHistoryBtn.focus();
    }
  };

  const saveInvoiceToHistory = () => {
    if (items.length === 0) {
      showToast('Add at least one line item before saving a snapshot.', 'warning');
      return;
    }

    const summary = computeFinancialSummary();
    const invoiceNumber = appState.meta.invoiceNumber.trim() || generateNextInvoiceNumber(false);
    appState.meta.invoiceNumber = invoiceNumber;
    dom.metaInvoiceNumber.value = invoiceNumber;
    recordInvoiceSequence(invoiceNumber);

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
    const matchingIndex = appState.history.findIndex((entry) => entry.meta.invoiceNumber === invoiceNumber);
    const history = matchingIndex >= 0
      ? appState.history.filter((_, index) => index !== matchingIndex)
      : appState.history.slice();
    if (matchingIndex >= 0) snapshot.archiveId = appState.history[matchingIndex].archiveId;
    appState.history = [snapshot, ...history];

    renderDocumentMeta();
    renderHistoryDrawer();
    persistWorkspace();
    showToast(`Saved ${invoiceNumber} to history.`, 'success');
  };

  const startNewInvoiceDraft = () => {
    setItems([]);
    appState.meta = {
      invoiceNumber: generateNextInvoiceNumber(true),
      issueDate: getTodayIso(),
      dueDate: getFutureIso(14),
      status: 'PENDING',
      documentMode: appState.meta.documentMode,
      notes: DEFAULT_NOTES
    };
    appState.customer = { name: '', contact: '', taxId: '', address: '' };
    appState.config.discountValue = 0;
    dom.itemNameInput.value = '';
    dom.itemQtyInput.value = '1';
    dom.itemPriceInput.value = '';
    clearValidationErrors();
    syncFormInputsFromState();
    renderAll();
    persistWorkspace();
    dom.itemNameInput.focus();
    showToast(`Started ${appState.meta.invoiceNumber}.`, 'info');
  };

  const buildSampleItems = () => [
    { id: generateUniqueId(), name: 'Enterprise Design System & UI Component Library', qty: 1, price: 45000, lineTotal: 45000 },
    { id: generateUniqueId(), name: 'Real-Time Billing & GST Reconciliation Engine', qty: 2, price: 22500, lineTotal: 45000 },
    { id: generateUniqueId(), name: 'Performance & Accessibility Compliance Audit (WCAG AA)', qty: 1, price: 16000, lineTotal: 16000 },
    { id: generateUniqueId(), name: 'Dedicated Cloud DevOps & CI/CD Pipeline Setup', qty: 3, price: 4500, lineTotal: 13500 }
  ];

  const loadDemoInvoice = (silent = false) => {
    const mode = appState.meta.documentMode || 'A4';
    setItems(buildSampleItems());
    appState.meta = {
      invoiceNumber: `INV-${new Date().getFullYear()}-108`,
      issueDate: getTodayIso(),
      dueDate: getFutureIso(14),
      status: 'PAID',
      documentMode: mode,
      notes: 'Settled by corporate transfer. Includes a 90-day post-launch support period.'
    };
    appState.customer = {
      name: 'Horizon FinServe Technologies Pvt. Ltd.',
      contact: 'finance@horizonfinserve.in · +91 80 4120 8899',
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
    recordInvoiceSequence(appState.meta.invoiceNumber);
    clearValidationErrors();
    syncFormInputsFromState();
    renderAll();
    persistWorkspace();
    if (!silent) showToast('Sample invoice loaded.', 'success');
  };

  const toCsvCell = (value) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };

  const exportInvoiceCsv = () => {
    if (items.length === 0) {
      showToast('Add at least one line item before exporting CSV.', 'warning');
      return;
    }

    const summary = computeFinancialSummary();
    const { meta, seller, customer, config } = appState;
    const csvRows = [
      ['Document type', meta.documentMode === 'RECEIPT' ? 'POS receipt' : 'Tax invoice'],
      ['Invoice number', meta.invoiceNumber],
      ['Status', meta.status],
      ['Issue date', meta.issueDate],
      ['Due date', meta.dueDate],
      ['Seller name', seller.businessName],
      ['Seller tax ID', seller.taxId],
      ['Customer name', customer.name || 'Walk-in / Cash Customer'],
      ['Customer tax ID', customer.taxId],
      ['Currency', config.currencyCode],
      [],
      ['Line', 'Description', 'Quantity', 'Unit price', 'Line total'],
      ...items.map((item, index) => [index + 1, item.name, item.qty, item.price.toFixed(2), item.lineTotal.toFixed(2)]),
      [],
      ['', '', '', 'Subtotal', summary.subtotal.toFixed(2)],
      ['', '', '', 'Discount', -summary.discountAmount],
      ...(config.splitGst
        ? [
            ['', '', '', `CGST (${(summary.taxRate / 2).toFixed(2)}%)`, summary.cgstAmount.toFixed(2)],
            ['', '', '', `SGST (${(summary.taxRate / 2).toFixed(2)}%)`, summary.sgstAmount.toFixed(2)]
          ]
        : [['', '', '', `Tax (${summary.taxRate.toFixed(2)}%)`, summary.taxAmount.toFixed(2)]]),
      ['', '', '', 'Grand total', summary.grandTotal.toFixed(2)]
    ];

    const content = `\uFEFF${csvRows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')}`;
    const objectUrl = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    const slug = (meta.invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = objectUrl;
    link.download = `QuickBill_${slug}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast(`Exported QuickBill_${slug}.csv.`, 'success');
  };

  const normalizeMeta = (value = {}) => {
    const status = String(value.status || 'PENDING').toUpperCase();
    const mode = value.documentMode === 'RECEIPT' ? 'RECEIPT' : 'A4';
    return {
      invoiceNumber: asText(value.invoiceNumber || generateNextInvoiceNumber(false), 40),
      issueDate: isIsoDate(value.issueDate) ? value.issueDate : getTodayIso(),
      dueDate: isIsoDate(value.dueDate) ? value.dueDate : getFutureIso(14),
      status: VALID_STATUSES.has(status) ? status : 'PENDING',
      documentMode: mode,
      notes: asText(value.notes ?? DEFAULT_NOTES, 320)
    };
  };

  const normalizeCustomer = (value = {}) => ({
    name: asText(value.name, 100),
    contact: asText(value.contact, 100),
    taxId: asText(value.taxId, 40),
    address: asText(value.address, 240)
  });

  const normalizeSeller = (value = {}) => ({
    businessName: asText(value.businessName ?? DEFAULT_SELLER.businessName, 100),
    email: asText(value.email ?? DEFAULT_SELLER.email, 100),
    phone: asText(value.phone ?? DEFAULT_SELLER.phone, 40),
    taxId: asText(value.taxId ?? DEFAULT_SELLER.taxId, 40),
    address: asText(value.address ?? DEFAULT_SELLER.address, 240)
  });

  const normalizeConfig = (value = {}) => {
    const currencyCode = CURRENCIES[value.currencyCode] ? value.currencyCode : 'INR';
    const discountType = value.discountType === 'FLAT' ? 'FLAT' : 'PERCENT';
    return {
      currencyCode,
      taxRate: roundMoney(clamp(toFiniteNumber(value.taxRate, 18), 0, 100)),
      splitGst: Boolean(value.splitGst),
      discountType,
      discountValue: Math.max(0, roundMoney(toFiniteNumber(value.discountValue)))
    };
  };

  const normalizeItems = (value) => {
    if (!Array.isArray(value)) return [];
    const usedIds = new Set();
    return value.map((rawItem) => {
      if (!rawItem || typeof rawItem !== 'object') return null;
      const name = asText(rawItem.name, 140).trim();
      const quantity = roundQuantity(toFiniteNumber(rawItem.qty, 0));
      const price = roundMoney(toFiniteNumber(rawItem.price, 0));
      if (!name || quantity <= 0 || price <= 0) return null;
      let id = Number(rawItem.id);
      if (!Number.isSafeInteger(id) || id <= 0 || usedIds.has(id)) id = generateUniqueId();
      usedIds.add(id);
      return { id, name, qty: quantity, price, lineTotal: roundMoney(quantity * price) };
    }).filter(Boolean);
  };

  const normalizeCatalog = (value) => {
    if (!Array.isArray(value)) return DEFAULT_CATALOG.map((preset) => ({ ...preset }));
    const entries = value.map((rawPreset, index) => {
      if (!rawPreset || typeof rawPreset !== 'object') return null;
      const name = asText(rawPreset.name, 140).trim();
      const price = roundMoney(toFiniteNumber(rawPreset.price, 0));
      if (!name || price <= 0) return null;
      return {
        id: asText(rawPreset.id || `custom-${index + 1}`, 80),
        name,
        price,
        isDefault: Boolean(rawPreset.isDefault)
      };
    }).filter(Boolean);
    return entries.length ? entries : DEFAULT_CATALOG.map((preset) => ({ ...preset }));
  };

  const normalizeHistory = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const entryItems = normalizeItems(entry.items);
      if (!entryItems.length) return null;
      const meta = normalizeMeta(entry.meta || {});
      const customer = normalizeCustomer(entry.customer || {});
      const seller = normalizeSeller(entry.seller || {});
      const config = normalizeConfig(entry.config || {});
      return {
        archiveId: asText(entry.archiveId || `arch-restored-${index}`, 100),
        savedAt: isNaN(Date.parse(entry.savedAt)) ? new Date().toISOString() : new Date(entry.savedAt).toISOString(),
        grandTotal: roundMoney(toFiniteNumber(entry.grandTotal)),
        items: entryItems,
        meta,
        customer,
        seller,
        config
      };
    }).filter(Boolean);
  };

  const bindEventListeners = () => {
    dom.itemForm.addEventListener('submit', addItem);

    dom.itemNameInput.addEventListener('input', () => {
      dom.itemNameInput.removeAttribute('aria-invalid');
      const typedName = dom.itemNameInput.value.trim().toLowerCase();
      const match = appState.catalog.find((preset) => preset.name.toLowerCase() === typedName);
      if (match && !dom.itemPriceInput.value) dom.itemPriceInput.value = String(match.price);
      if (!dom.formErrorBanner.hidden) clearValidationErrors();
    });

    dom.itemQtyInput.addEventListener('input', () => {
      dom.itemQtyInput.removeAttribute('aria-invalid');
      if (!dom.formErrorBanner.hidden) clearValidationErrors();
    });
    dom.itemPriceInput.addEventListener('input', () => {
      dom.itemPriceInput.removeAttribute('aria-invalid');
      if (!dom.formErrorBanner.hidden) clearValidationErrors();
    });

    dom.itemNameInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!dom.itemNameInput.value.trim()) {
        triggerFieldValidationError(dom.itemNameInput, 'Enter an item description before continuing.');
        return;
      }
      clearValidationErrors();
      dom.itemQtyInput.focus();
      dom.itemQtyInput.select();
    });

    dom.itemQtyInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const quantity = Number(dom.itemQtyInput.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        triggerFieldValidationError(dom.itemQtyInput, 'Quantity must be greater than zero.');
        return;
      }
      clearValidationErrors();
      dom.itemPriceInput.focus();
      dom.itemPriceInput.select();
    });

    dom.clearItemsBtn.addEventListener('click', () => {
      if (items.length === 0) return;
      setItems([]);
      renderTable();
      updateTotals();
      persistWorkspace();
      showToast('Line items cleared.', 'info');
    });

    dom.tbody.addEventListener('click', (event) => {
      const button = event.target.closest('.delete-btn');
      if (!button) return;
      const id = Number(button.dataset.id);
      setItems(items.filter((item) => item.id !== id));
      renderTable();
      updateTotals();
      persistWorkspace();
      showToast('Line item removed.', 'info');
    });

    dom.tbody.addEventListener('input', (event) => {
      const input = event.target.closest('.inline-edit-input');
      if (!input) return;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) {
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      const item = items.find((entry) => entry.id === Number(input.dataset.id));
      if (!item) return;
      const normalized = input.dataset.field === 'qty' ? roundQuantity(value) : roundMoney(value);
      if (normalized <= 0) {
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      input.removeAttribute('aria-invalid');
      item[input.dataset.field] = normalized;
      item.lineTotal = roundMoney(item.qty * item.price);
      const lineTotalCell = input.closest('tr')?.querySelector('[data-role="line-total"]');
      if (lineTotalCell) lineTotalCell.textContent = formatCurrency(item.lineTotal);
      updateTotals();
      persistWorkspace();
    });

    dom.tbody.addEventListener('change', (event) => {
      const input = event.target.closest('.inline-edit-input');
      if (!input) return;
      const item = items.find((entry) => entry.id === Number(input.dataset.id));
      if (!item) return;
      const value = Number(input.value);
      const normalized = input.dataset.field === 'qty' ? roundQuantity(value) : roundMoney(value);
      if (!Number.isFinite(value) || value <= 0 || normalized <= 0) {
        input.value = String(item[input.dataset.field]);
        input.removeAttribute('aria-invalid');
        showToast('Quantity and unit price must be greater than zero.', 'warning');
        return;
      }
      input.value = String(normalized);
      item[input.dataset.field] = normalized;
      item.lineTotal = roundMoney(item.qty * item.price);
      const lineTotalCell = input.closest('tr')?.querySelector('[data-role="line-total"]');
      if (lineTotalCell) lineTotalCell.textContent = formatCurrency(item.lineTotal);
      updateTotals();
      persistWorkspace();
    });

    dom.tbody.addEventListener('keydown', (event) => {
      if (event.target.matches('.inline-edit-input') && event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
      }
    });

    dom.catalogChips.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const preset = appState.catalog.find((entry) => entry.id === actionButton.dataset.presetId);
      if (!preset) return;

      if (actionButton.dataset.action === 'select-preset') {
        clearValidationErrors();
        dom.itemNameInput.value = preset.name;
        dom.itemPriceInput.value = String(preset.price);
        if (!dom.itemQtyInput.value || Number(dom.itemQtyInput.value) <= 0) dom.itemQtyInput.value = '1';
        dom.itemQtyInput.focus();
        dom.itemQtyInput.select();
      } else if (actionButton.dataset.action === 'remove-preset' && !preset.isDefault) {
        appState.catalog = appState.catalog.filter((entry) => entry.id !== preset.id);
        renderCatalog();
        persistWorkspace();
        showToast('Removed saved catalog item.', 'info');
      }
    });

    dom.savePresetBtn.addEventListener('click', saveCurrentAsPreset);

    const bindTextSync = (element, updater) => {
      element.addEventListener('input', () => {
        updater(element.value);
        renderDocumentMeta();
        persistWorkspace();
      });
    };

    bindTextSync(dom.metaInvoiceNumber, (value) => { appState.meta.invoiceNumber = value; });
    bindTextSync(dom.metaIssueDate, (value) => { appState.meta.issueDate = value; });
    bindTextSync(dom.metaDueDate, (value) => { appState.meta.dueDate = value; });
    bindTextSync(dom.metaNotes, (value) => { appState.meta.notes = value; });
    bindTextSync(dom.customerName, (value) => { appState.customer.name = value; });
    bindTextSync(dom.customerContact, (value) => { appState.customer.contact = value; });
    bindTextSync(dom.customerTaxId, (value) => { appState.customer.taxId = value; });
    bindTextSync(dom.customerAddress, (value) => { appState.customer.address = value; });
    bindTextSync(dom.sellerName, (value) => { appState.seller.businessName = value; });
    bindTextSync(dom.sellerEmail, (value) => { appState.seller.email = value; });
    bindTextSync(dom.sellerPhone, (value) => { appState.seller.phone = value; });
    bindTextSync(dom.sellerTaxId, (value) => { appState.seller.taxId = value; });
    bindTextSync(dom.sellerAddress, (value) => { appState.seller.address = value; });

    dom.sellerEmail.addEventListener('input', () => {
      const invalid = Boolean(dom.sellerEmail.value) && !dom.sellerEmail.checkValidity();
      dom.sellerEmail.setAttribute('aria-invalid', String(invalid));
    });

    dom.metaStatus.addEventListener('change', () => {
      appState.meta.status = VALID_STATUSES.has(dom.metaStatus.value) ? dom.metaStatus.value : 'PENDING';
      renderDocumentMeta();
      persistWorkspace();
    });

    dom.resetSellerBtn.addEventListener('click', () => {
      appState.seller = { ...DEFAULT_SELLER };
      syncFormInputsFromState();
      renderDocumentMeta();
      persistWorkspace();
      showToast('Restored sample seller details.', 'info');
    });

    dom.configCurrency.addEventListener('change', () => {
      appState.config.currencyCode = CURRENCIES[dom.configCurrency.value] ? dom.configCurrency.value : 'INR';
      renderDocumentMeta();
      renderCatalog();
      renderTable();
      updateTotals();
      persistWorkspace();
    });

    dom.configTaxRate.addEventListener('input', () => {
      appState.config.taxRate = roundMoney(clamp(toFiniteNumber(dom.configTaxRate.value), 0, 100));
      updateTotals();
      persistWorkspace();
    });
    dom.configTaxRate.addEventListener('change', () => {
      dom.configTaxRate.value = String(appState.config.taxRate);
    });

    dom.configSplitGst.addEventListener('change', () => {
      appState.config.splitGst = dom.configSplitGst.checked;
      updateTotals();
      persistWorkspace();
    });

    dom.configDiscountType.addEventListener('change', () => {
      appState.config.discountType = dom.configDiscountType.value === 'FLAT' ? 'FLAT' : 'PERCENT';
      updateTotals();
      persistWorkspace();
    });

    dom.configDiscountValue.addEventListener('input', () => {
      appState.config.discountValue = Math.max(0, roundMoney(toFiniteNumber(dom.configDiscountValue.value)));
      updateTotals();
      persistWorkspace();
    });
    dom.configDiscountValue.addEventListener('change', () => {
      dom.configDiscountValue.value = String(appState.config.discountValue);
    });

    const setDocumentMode = (mode) => {
      appState.meta.documentMode = mode === 'RECEIPT' ? 'RECEIPT' : 'A4';
      renderDocumentMeta();
      persistWorkspace();
    };
    dom.modeA4Btn.addEventListener('click', () => setDocumentMode('A4'));
    dom.modeReceiptBtn.addEventListener('click', () => setDocumentMode('RECEIPT'));

    const triggerPrint = () => window.print();
    dom.printInvoiceBtn.addEventListener('click', triggerPrint);
    dom.mobilePrintBtn.addEventListener('click', triggerPrint);
    dom.jumpPreviewBtn.addEventListener('click', () => {
      dom.previewStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    dom.loadDemoBtn.addEventListener('click', () => loadDemoInvoice(false));
    dom.newInvoiceBtn.addEventListener('click', startNewInvoiceDraft);
    dom.saveHistoryBtn.addEventListener('click', saveInvoiceToHistory);
    dom.exportCsvBtn.addEventListener('click', exportInvoiceCsv);

    dom.openHistoryBtn.addEventListener('click', () => toggleHistoryDrawer(true));
    dom.closeHistoryBtn.addEventListener('click', () => toggleHistoryDrawer(false));
    dom.historyBackdrop.addEventListener('click', () => toggleHistoryDrawer(false));
    dom.historySearchInput.addEventListener('input', renderHistoryDrawer);

    dom.clearHistoryBtn.addEventListener('click', () => {
      if (appState.history.length === 0) return;
      appState.history = [];
      renderHistoryDrawer();
      persistWorkspace();
      showToast('Invoice history cleared. This cannot be undone.', 'info');
    });

    dom.historyList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-history-action]');
      if (!button) return;
      const entry = appState.history.find((record) => record.archiveId === button.dataset.historyId);
      if (!entry) return;

      if (button.dataset.historyAction === 'load') {
        setItems(entry.items.map((item) => ({ ...item })));
        appState.meta = { ...appState.meta, ...entry.meta };
        appState.customer = { ...appState.customer, ...entry.customer };
        appState.seller = { ...DEFAULT_SELLER, ...entry.seller };
        appState.config = { ...appState.config, ...entry.config };
        syncFormInputsFromState();
        renderAll();
        persistWorkspace();
        toggleHistoryDrawer(false);
        showToast(`Loaded ${appState.meta.invoiceNumber}.`, 'success');
      } else if (button.dataset.historyAction === 'duplicate') {
        setItems(entry.items.map((item) => ({ ...item, id: generateUniqueId() })));
        appState.meta = {
          ...appState.meta,
          ...entry.meta,
          invoiceNumber: generateNextInvoiceNumber(true),
          issueDate: getTodayIso(),
          dueDate: getFutureIso(14),
          status: 'PENDING'
        };
        appState.customer = { ...appState.customer, ...entry.customer };
        appState.seller = { ...DEFAULT_SELLER, ...entry.seller };
        appState.config = { ...appState.config, ...entry.config };
        syncFormInputsFromState();
        renderAll();
        persistWorkspace();
        toggleHistoryDrawer(false);
        showToast(`Duplicated as ${appState.meta.invoiceNumber}.`, 'success');
      } else if (button.dataset.historyAction === 'delete') {
        appState.history = appState.history.filter((record) => record.archiveId !== entry.archiveId);
        renderHistoryDrawer();
        persistWorkspace();
        showToast('Removed invoice from history.', 'info');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!dom.historyDrawer.hidden) toggleHistoryDrawer(false);
        else clearValidationErrors();
        return;
      }

      if (!dom.historyDrawer.hidden && event.key === 'Tab') {
        const focusable = [...dom.historyDrawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        const actions = {
          n: startNewInvoiceDraft,
          s: saveInvoiceToHistory,
          h: () => toggleHistoryDrawer(),
          d: () => loadDemoInvoice(false)
        };
        if (actions[key]) {
          event.preventDefault();
          actions[key]();
        }
      }
    });
  };

  const hydrateAndBootstrap = () => {
    const savedSeller = safeStorageGet(STORAGE_KEYS.seller, null);
    if (savedSeller && typeof savedSeller === 'object') appState.seller = normalizeSeller(savedSeller);

    appState.catalog = normalizeCatalog(safeStorageGet(STORAGE_KEYS.catalog, null));
    appState.history = normalizeHistory(safeStorageGet(STORAGE_KEYS.history, []));

    const savedDraft = safeStorageGet(STORAGE_KEYS.draft, null);
    if (savedDraft && typeof savedDraft === 'object') {
      setItems(normalizeItems(savedDraft.items));
      appState.meta = normalizeMeta({ ...appState.meta, ...(savedDraft.meta || {}) });
      appState.customer = normalizeCustomer(savedDraft.customer || {});
      appState.config = normalizeConfig({ ...appState.config, ...(savedDraft.config || {}) });
      recordInvoiceSequence(appState.meta.invoiceNumber);
      syncFormInputsFromState();
      renderAll();
    } else {
      loadDemoInvoice(true);
    }

    bindEventListeners();
  };

  hydrateAndBootstrap();
})();
