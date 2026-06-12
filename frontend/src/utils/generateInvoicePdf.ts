// utils/generateInvoicePdf.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generates a GST-compliant tax invoice as a printable HTML page.
// Opens in a new tab → user clicks Print → Save as PDF.
// No external library needed — works in all modern browsers.
// ─────────────────────────────────────────────────────────────────────────────

import type { Order } from '../types/order';

// ── Seller details — update these to match your GSTIN registration ───────────
const SELLER = {
  name: 'Kore Mobile',
  gstin: '24XXXXXXXXXXXXX',          // ← your actual GSTIN
  address: 'acc Road, Near Bus Stand',
  city: 'ca',
  state: 'ca',
  stateCode: '56',
  pincode: '',
  phone: '+91 94269 xxxxxx',
  email: 'yourmail@mail.in',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateInvoicePdf(order: Order): void {
  const addr = order.address;
  const buyerGstin = addr.gstin ?? null;

  // Build item rows
  const itemRows = order.items.map((item, idx) => {
    const cgst = item.cgst_amount ?? item.gst_subtotal / 2;
    const sgst = item.sgst_amount ?? item.gst_subtotal / 2;
    const gstRate = item.gst_rate ?? 0;
    const cgstRate = gstRate / 2;
    const sgstRate = gstRate / 2;

    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>
          <strong>${item.product_name}</strong><br/>
          <span class="sub">${item.variant_label ?? ''}</span>
          ${item.hsn_code ? `<br/><span class="sub">HSN: ${item.hsn_code}</span>` : ''}
        </td>
        <td class="center">${item.quantity}</td>
        <td class="right">₹${fmt(item.base_price)}</td>
        <td class="right">₹${fmt(item.taxable_subtotal)}</td>
        <td class="center">${cgstRate}%</td>
        <td class="right">₹${fmt(cgst)}</td>
        <td class="center">${sgstRate}%</td>
        <td class="right">₹${fmt(sgst)}</td>
        <td class="right bold">₹${fmt(item.subtotal)}</td>
      </tr>
    `;
  }).join('');

  const totalCgst = order.total_cgst ?? order.total_gst / 2;
  const totalSgst = order.total_sgst ?? order.total_gst / 2;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tax Invoice – ${order.order_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }

    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm; }

    /* ── Header ── */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 10px; }
    .brand { font-size: 22px; font-weight: 900; color: #1a1a1a; letter-spacing: -0.5px; }
    .brand span { color: #e53e3e; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-title p { font-size: 11px; color: #555; margin-top: 2px; }

    /* ── Info grid ── */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ccc; margin-bottom: 12px; }
    .info-box { padding: 8px 10px; border-right: 1px solid #ccc; }
    .info-box:nth-child(even) { border-right: none; }
    .info-box:nth-child(n+3) { border-top: 1px solid #ccc; }
    .info-box h4 { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-box p { font-size: 11.5px; line-height: 1.5; }
    .info-box p strong { font-size: 12px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
    thead th { background: #1a1a1a; color: #fff; padding: 6px 5px; text-align: center; font-size: 10.5px; }
    thead th.left { text-align: left; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    tbody td { padding: 6px 5px; vertical-align: top; border-bottom: 1px solid #e2e2e2; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .sub { font-size: 10px; color: #666; }

    /* ── Totals ── */
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .totals-table { width: 280px; border: 1px solid #ccc; }
    .totals-table tr td { padding: 5px 10px; border-bottom: 1px solid #e8e8e8; font-size: 11.5px; }
    .totals-table tr td:last-child { text-align: right; font-weight: 600; }
    .totals-table .grand-total td { background: #1a1a1a; color: #fff; font-size: 13px; font-weight: 700; border-bottom: none; }

    /* ── Amount in words ── */
    .amount-words { border: 1px solid #ccc; padding: 7px 10px; margin-bottom: 12px; font-size: 11px; background: #fafafa; }
    .amount-words span { font-weight: 600; }

    /* ── Notes ── */
    .notes { font-size: 10.5px; color: #555; line-height: 1.6; border-top: 1px solid #ccc; padding-top: 8px; }
    .notes strong { color: #111; }

    /* ── Footer ── */
    .footer { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 10px; }
    .footer .sig { text-align: right; }
    .footer .sig p { font-size: 10px; color: #666; }
    .footer .sig .sig-line { margin-top: 30px; border-top: 1px solid #333; width: 140px; margin-left: auto; text-align: center; padding-top: 3px; font-size: 10px; }

    /* ── Print ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 8mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="text-align:right; margin-bottom:12px;">
    <button onclick="window.print()"
      style="padding:8px 20px; background:#1a1a1a; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:13px;">
      🖨 Print / Save as PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">Vaibhav<span>Sales</span></div>
      <p style="font-size:11px; margin-top:4px; color:#555;">${SELLER.address}</p>
      <p style="font-size:11px; color:#555;">${SELLER.city}, ${SELLER.state} – ${SELLER.pincode}</p>
      <p style="font-size:11px; color:#555;">GSTIN: <strong>${SELLER.gstin}</strong> | State Code: ${SELLER.stateCode}</p>
      <p style="font-size:11px; color:#555;">${SELLER.phone} | ${SELLER.email}</p>
    </div>
    <div class="invoice-title">
      <h2>Tax Invoice</h2>
      <p>Invoice No: <strong>${order.order_number}</strong></p>
      <p>Date: <strong>${fmtDate(order.created_at)}</strong></p>
      <p style="margin-top:6px; color: ${order.payment_status === 'paid' ? '#2d8a4e' : '#c05200'}; font-weight:700;">
        ${order.payment_status === 'paid' ? '✔ PAID' : order.payment_method === 'cod' ? 'CASH ON DELIVERY' : 'PAYMENT PENDING'}
      </p>
    </div>
  </div>

  <!-- Seller & Buyer -->
  <div class="info-grid">
    <div class="info-box">
      <h4>Sold By (Supplier)</h4>
      <p><strong>${SELLER.name}</strong><br/>
      ${SELLER.address}<br/>
      ${SELLER.city}, ${SELLER.state} – ${SELLER.pincode}<br/>
      GSTIN: ${SELLER.gstin}<br/>
      State: ${SELLER.state} (${SELLER.stateCode})</p>
    </div>
    <div class="info-box">
      <h4>Bill To (Recipient)</h4>
      <p><strong>${addr.name}</strong><br/>
      ${addr.house_no}, ${addr.area}<br/>
      ${addr.village}, ${addr.taluka}<br/>
      ${addr.district}, ${addr.state} – ${addr.pincode}<br/>
      Phone: ${addr.phone}
      ${buyerGstin ? `<br/>GSTIN: ${buyerGstin}` : ''}
      </p>
    </div>
    <div class="info-box">
      <h4>Shipping Address</h4>
      <p><strong>${addr.name}</strong><br/>
      ${addr.house_no}, ${addr.area}, ${addr.village}<br/>
      ${addr.taluka}, ${addr.district}<br/>
      ${addr.state} – ${addr.pincode}</p>
    </div>
    <div class="info-box">
      <h4>Payment Info</h4>
      <p>
        Method: <strong>${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</strong><br/>
        Status: <strong>${order.payment_status.replace('_', ' ').toUpperCase()}</strong><br/>
        Order Status: <strong>${order.status.replace('_', ' ').toUpperCase()}</strong>
        ${order.tracking_number ? `<br/>Tracking: <strong>${order.tracking_number}</strong>` : ''}
      </p>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th class="left">Description of Goods</th>
        <th style="width:35px">Qty</th>
        <th style="width:75px">Rate<br/>(Ex-GST)</th>
        <th style="width:75px">Taxable<br/>Value</th>
        <th style="width:45px">CGST<br/>Rate</th>
        <th style="width:65px">CGST<br/>Amt</th>
        <th style="width:45px">SGST<br/>Rate</th>
        <th style="width:65px">SGST<br/>Amt</th>
        <th style="width:80px">Total<br/>(Incl. GST)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr style="background:#f0f0f0; font-weight:700;">
        <td colspan="4" class="right" style="padding:6px 5px;">Total</td>
        <td class="right">₹${fmt(order.taxable_amount)}</td>
        <td></td>
        <td class="right">₹${fmt(totalCgst)}</td>
        <td></td>
        <td class="right">₹${fmt(totalSgst)}</td>
        <td class="right">₹${fmt(order.subtotal)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Totals summary -->
  <div class="totals-wrap">
    <table class="totals-table">
      <tbody>
        <tr><td>Taxable Amount</td><td>₹${fmt(order.taxable_amount)}</td></tr>
        <tr><td>CGST</td><td>₹${fmt(totalCgst)}</td></tr>
        <tr><td>SGST</td><td>₹${fmt(totalSgst)}</td></tr>
        <tr><td>Total GST</td><td>₹${fmt(order.total_gst)}</td></tr>
        <tr><td>Subtotal (Incl. GST)</td><td>₹${fmt(order.subtotal)}</td></tr>
        <tr><td>Shipping</td><td>${order.shipping_fee > 0 ? '₹' + fmt(order.shipping_fee) : 'FREE'}</td></tr>
        <tr class="grand-total"><td>Grand Total</td><td>₹${fmt(order.total)}</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Amount in words -->
  <div class="amount-words">
    Amount in words: <span>${numberToWords(Math.round(order.total))} Rupees Only</span>
  </div>

  <!-- Notes -->
  <div class="notes">
    <strong>Notes:</strong><br/>
    1. This is a computer-generated invoice and does not require a physical signature.<br/>
    2. All prices are inclusive of GST. CGST and SGST each at half the applicable rate (intra-state supply — abc).<br/>
    3. Goods once sold will not be taken back or exchanged unless defective. Subject to abc jurisdiction.
  </div>

  <!-- Footer / Signature -->
  <div class="footer">
    <div style="font-size:10px; color:#666; max-width:200px;">
      <p>Thank you for shopping with Vaibhav Sales!</p>
      <p style="margin-top:4px;">${SELLER.email}</p>
    </div>
    <div class="sig">
      <p>For <strong>${SELLER.name}</strong></p>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to download the invoice.');
    return;
  }
  win.document.write(html);
  win.document.close();
  // Small delay so styles load before auto-print
  // setTimeout(() => win.print(), 600);
}


// ── Number to Indian words (up to crores) ────────────────────────────────────

function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  }

  function threeDigits(num: number): string {
    if (num >= 100) {
      return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + twoDigits(num % 100) : '');
    }
    return twoDigits(num);
  }

  let result = '';
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore) result += threeDigits(crore) + ' Crore ';
  if (lakh) result += twoDigits(lakh) + ' Lakh ';
  if (thousand) result += twoDigits(thousand) + ' Thousand ';
  if (remainder) result += threeDigits(remainder);

  return result.trim();
}
