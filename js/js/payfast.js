// ── SIPD PAYFAST INTEGRATION ─────────────────────────────────────────
//
// PayFast integration for Sipd SA
//
// LIVE SETUP INSTRUCTIONS:
// 1. Register at https://www.payfast.co.za and get a merchant account
// 2. Enable "Split Payments" in your PayFast dashboard
// 3. Replace PAYFAST_CONFIG values below with your actual credentials
// 4. Set your ITN (Instant Transaction Notification) URL to:
//    https://yourdomain.co.za/api/payfast-itn
// 5. For automated payouts, use PayFast's Onsite Payments API
//
// PayFast charges: 2.0% + R2.00 per transaction (capped at R40 for cards)
// For EFT: free (most popular in SA)
// ─────────────────────────────────────────────────────────────────────

const PayFast = (() => {

  // ── CONFIG (replace with live values before going live) ──
  const CONFIG = {
    merchantId:  '10000100',          // Your PayFast Merchant ID
    merchantKey: '46f0cd694581a',      // Your PayFast Merchant Key
    passphrase:  'jt7NOE43FZPn',       // Your PayFast Passphrase (set in dashboard)
    sandbox:     true,                 // Set to FALSE for live payments
    returnUrl:   window.location.origin + '/app.html?payment=success',
    cancelUrl:   window.location.origin + '/app.html?payment=cancel',
    notifyUrl:   window.location.origin + '/api/payfast-itn', // your backend ITN endpoint
  };

  const ENDPOINT = CONFIG.sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';

  // Cup prices in ZAR cents (PayFast uses cents)
  const PRICES = {
    joining: 500,   // R5.00
    small:   5500,  // R55.00
    medium:  9000,  // R90.00
    large:  16500,  // R165.00
  };

  const PRICE_DISPLAY = {
    joining: 'R 5',
    small:   'R 55',
    medium:  'R 90',
    large:   'R 165',
  };

  // Generate a unique payment reference
  function generateRef(prefix = 'SIPD') {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  // Build the PayFast payment form and auto-submit
  // In a real build, this would POST to PayFast's gateway
  function initiatePayment({ type, amount, buyerId, recipientId, recipientName, onSuccess }) {
    const ref = generateRef();

    // In SANDBOX / DEMO mode: simulate payment and call onSuccess directly
    if (CONFIG.sandbox) {
      simulatePayment({ type, amount, buyerId, recipientId, recipientName, ref, onSuccess });
      return ref;
    }

    // ── LIVE MODE: Build hidden form and POST to PayFast ──
    // PayFast will redirect user to their payment page
    // On success, PayFast redirects to returnUrl and sends ITN to notifyUrl

    const params = {
      merchant_id:  CONFIG.merchantId,
      merchant_key: CONFIG.merchantKey,
      return_url:   CONFIG.returnUrl,
      cancel_url:   CONFIG.cancelUrl,
      notify_url:   CONFIG.notifyUrl,
      name_first:   buyerId,
      email_address: '',               // populate from user profile in real build
      m_payment_id: ref,
      amount:       (amount / 100).toFixed(2),
      item_name:    `Sipd ${type} payment`,
      item_description: `Sipd cup gift - ${type}`,
      custom_str1:  buyerId,
      custom_str2:  recipientId || '',
      custom_str3:  type,
    };

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = ENDPOINT;

    Object.entries(params).forEach(([key, val]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = val;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    return ref;
  }

  // ── SIMULATION (sandbox / demo only) ──
  function simulatePayment({ type, amount, buyerId, recipientId, recipientName, ref, onSuccess }) {
    const display = document.getElementById('payment-modal');
    if (display) showPaymentModal({ type, amount, recipientName, ref, onSuccess });
    else {
      // No modal — just call success after short delay
      setTimeout(() => {
        onSuccess && onSuccess({ ref, amount, type, recipientId, status: 'COMPLETE' });
      }, 1200);
    }
  }

  // Show a simulated PayFast payment modal (sandbox UI)
  function showPaymentModal({ type, amount, recipientName, ref, onSuccess }) {
    const amtDisplay = (amount / 100).toFixed(2);
    const typeLabel = type === 'joining' ? 'Joining Fee' : `${type.charAt(0).toUpperCase()+type.slice(1)} Cup`;

    const modal = document.getElementById('payment-modal');
    modal.innerHTML = `
      <div class="pf-overlay" onclick="PayFast.closeModal()">
        <div class="pf-box" onclick="event.stopPropagation()">
          <div class="pf-header">
            <div class="pf-logo">PayFast <span>Sandbox</span></div>
            <button class="pf-close" onclick="PayFast.closeModal()">✕</button>
          </div>
          <div class="pf-merchant">sipd<span style="color:var(--accent)">.</span></div>
          <div class="pf-amount">R ${amtDisplay}</div>
          <div class="pf-desc">${typeLabel}${recipientName ? ' for ' + recipientName : ''}</div>
          <div class="pf-ref">Ref: ${ref}</div>
          <div class="pf-methods">
            <div class="pf-method active" onclick="selectMethod(this)">Instant EFT</div>
            <div class="pf-method" onclick="selectMethod(this)">Credit Card</div>
            <div class="pf-method" onclick="selectMethod(this)">Debit Card</div>
          </div>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="PayFast._confirmPayment('${ref}')">
            Pay R ${amtDisplay} Now
          </button>
          <p style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px">
            This is a sandbox simulation. No real money is transferred.
          </p>
        </div>
      </div>`;
    modal.style.display = 'block';
    modal._onSuccess = onSuccess;
    modal._ref = ref;
    modal._amount = amount;
    modal._type = type;
  }

  function _confirmPayment(ref) {
    const modal = document.getElementById('payment-modal');
    const box = modal.querySelector('.pf-box');
    box.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem">
        <div style="font-size:36px;margin-bottom:12px">✓</div>
        <div style="font-size:16px;font-weight:500;color:var(--green);margin-bottom:6px">Payment Successful</div>
        <div style="font-size:13px;color:var(--text2)">Ref: ${ref}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">Processing…</div>
      </div>`;
    setTimeout(() => {
      closeModal();
      if (modal._onSuccess) {
        modal._onSuccess({ ref, amount: modal._amount, type: modal._type, status: 'COMPLETE' });
      }
    }, 1500);
  }

  function closeModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) { modal.style.display = 'none'; modal.innerHTML = ''; }
  }

  function selectMethod(el) {
    document.querySelectorAll('.pf-method').forEach(m => m.classList.remove('active'));
    el.classList.add('active');
  }

  return {
    CONFIG, PRICES, PRICE_DISPLAY, ENDPOINT,
    initiatePayment, generateRef, closeModal, _confirmPayment,
  };
})();
