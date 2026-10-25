// Admin Donations & Donors Page
let me = null;

const $ = (x) => document.getElementById(x);

function addCell(tr, content) {
  const td = document.createElement('td');
  if (content instanceof Node) td.appendChild(content);
  else td.textContent = content;
  tr.appendChild(td);
}

function showMsg(text, good) {
  $('msg').innerHTML = '';
  if (!text) return;
  const a = document.createElement('div');
  a.className = 'alert ' + (good ? 'alert-success' : 'alert-danger');
  a.textContent = text;
  $('msg').appendChild(a);
}

function formatDate(d) {
  if (!d) return '-';
  return String(d).slice(0, 10);
}

async function load() {
  const p = new URLSearchParams();
  const search = $('f-search').value.trim();
  if (search) p.set('search', search);

  if (me.role === 'Global Admin' && $('f-shelter') && $('f-shelter').value) {
    p.set('shelter_id', $('f-shelter').value);
  }

  const r = await api('/api/admin/donations?' + p.toString());
  $('rows').innerHTML = '';

  if (!r.ok) {
    showMsg(r.data.error || 'Could not load donations', false);
    $('stat-total').textContent = '₹0';
    $('stat-count').textContent = '0';
    $('stat-donors').textContent = '0';
    $('count').textContent = '';
    return;
  }

  const { donations, total_amount, total_donations, unique_donors } = r.data;

  // Update summary stats
  $('stat-total').textContent = '₹' + Number(total_amount).toLocaleString('en-IN');
  $('stat-count').textContent = total_donations;
  $('stat-donors').textContent = unique_donors;
  $('count').textContent = donations.length + ' donation(s) found';

  if (!donations.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" class="text-center text-muted py-4">No donations recorded yet.</td>';
    $('rows').appendChild(tr);
    return;
  }

  donations.forEach((d) => {
    const tr = document.createElement('tr');

    // Ref ID
    const refBadge = document.createElement('span');
    refBadge.className = 'badge bg-light text-dark font-monospace';
    refBadge.textContent = `#DON-${d.donation_id}`;
    addCell(tr, refBadge);

    // Donor Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'fw-semibold text-dark';
    nameSpan.textContent = d.donor_name;
    addCell(tr, nameSpan);

    // Contact
    const contactDiv = document.createElement('div');
    contactDiv.innerHTML = `<div>${d.donor_email}</div><small class="text-muted">${d.donor_phone || '-'}</small>`;
    addCell(tr, contactDiv);

    // Amount
    const amtSpan = document.createElement('span');
    amtSpan.className = 'fw-bold text-success';
    amtSpan.textContent = '₹' + Number(d.amount).toLocaleString('en-IN');
    addCell(tr, amtSpan);

    // Date
    addCell(tr, formatDate(d.donated_on));

    // Shelter Name
    const shSpan = document.createElement('span');
    shSpan.className = 'badge bg-secondary';
    shSpan.textContent = d.shelter_name;
    addCell(tr, shSpan);

    // Address
    addCell(tr, d.donor_address || '-');

    $('rows').appendChild(tr);
  });
}

async function start() {
  const m = await api('/api/me');
  if (!m.data.loggedIn || (m.data.role !== 'Admin' && m.data.role !== 'Global Admin')) {
    window.location = '/login.html';
    return;
  }
  me = m.data;

  if (me.role === 'Global Admin') {
    // Unhide Shelters tab in nav
    const sTab = document.getElementById('shelters-tab');
    if (sTab) sTab.classList.remove('d-none');

    // Setup shelter filter dropdown
    const o = await api('/api/admin/options');
    if (o.ok && o.data.shelters) {
      $('shelter-box').classList.remove('d-none');
      o.data.shelters.forEach((s) => {
        const op = document.createElement('option');
        op.value = s.shelter_id;
        op.textContent = s.name;
        $('f-shelter').appendChild(op);
      });
    }
    $('f-shelter').addEventListener('change', load);
  }

  $('filters').addEventListener('submit', (e) => {
    e.preventDefault();
    load();
  });

  $('clear').addEventListener('click', () => {
    $('filters').reset();
    load();
  });

  load();
}

start();
