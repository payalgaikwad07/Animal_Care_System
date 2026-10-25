// Admin animal list page: filters + table.
let me = null;

// 14 months -> "1 yr 2 mo"
function age(m) {
  if (m < 12) return m + ' mo';
  const y = Math.floor(m / 12);
  const r = m % 12;
  return y + ' yr' + (r ? ' ' + r + ' mo' : '');
}

function badge(s) {
  const colors = {
    'Available': 'bg-success',
    'Under Treatment': 'bg-warning text-dark',
    'Fostered': 'bg-info text-dark',
    'Adopted': 'bg-secondary'
  };
  const b = document.createElement('span');
  b.className = 'badge ' + (colors[s] || 'bg-light text-dark');
  b.textContent = s;
  return b;
}

// add one <td> to a row. Text goes in with textContent, so it can never run as HTML.
function addCell(tr, content) {
  const td = document.createElement('td');
  if (content instanceof Node) td.appendChild(content);
  else td.textContent = content;
  tr.appendChild(td);
}

function fillSelect(sel, items, valueKey, textKey) {
  items.forEach((x) => {
    const o = document.createElement('option');
    o.value = valueKey ? x[valueKey] : x;
    o.textContent = textKey ? x[textKey] : x;
    sel.appendChild(o);
  });
}

async function load() {
  const p = new URLSearchParams();
  const name = document.getElementById('f-name').value.trim();
  if (name) p.set('name', name);
  if (document.getElementById('f-status').value) p.set('status', document.getElementById('f-status').value);
  if (document.getElementById('f-species').value) p.set('species', document.getElementById('f-species').value);
  if (document.getElementById('f-due').checked) p.set('due', '1');
  if (me.role === 'Global Admin' && document.getElementById('f-shelter').value) {
    p.set('shelter_id', document.getElementById('f-shelter').value);
  }

  const r = await api('/api/admin/animals?' + p.toString());
  const body = document.getElementById('rows');
  body.innerHTML = '';
  document.getElementById('err').textContent = '';

  if (!r.ok) {
    document.getElementById('err').textContent = r.data.error || 'Could not load animals';
    document.getElementById('count').textContent = '';
    return;
  }

  document.getElementById('count').textContent = r.data.length + ' animal(s) found';
  r.data.forEach((a) => {
    const tr = document.createElement('tr');
    addCell(tr, a.animal_id);
    addCell(tr, a.name);
    addCell(tr, a.species);
    addCell(tr, a.breed || '-');
    addCell(tr, age(a.age_months));
    addCell(tr, a.gender);
    addCell(tr, badge(a.status));
    addCell(tr, a.shelter);
    addCell(tr, String(a.intake_date).slice(0, 10));

    const link = document.createElement('a');
    link.className = 'btn btn-sm btn-outline-primary';
    link.href = '/admin/animal-form.html?id=' + a.animal_id;
    link.textContent = 'View / Edit';
    addCell(tr, link);

    body.appendChild(tr);
  });
}

async function start() {
  // This check only decides what the page shows. The real protection is on the server.
  const m = await api('/api/me');
  if (!m.data.loggedIn || (m.data.role !== 'Admin' && m.data.role !== 'Global Admin')) {
    window.location = '/login.html';
    return;
  }
  me = m.data;

  const o = await api('/api/admin/options');
  if (o.ok) {
    fillSelect(document.getElementById('f-species'), o.data.species);
    if (me.role === 'Global Admin') {
      document.getElementById('shelter-box').classList.remove('d-none');
      fillSelect(document.getElementById('f-shelter'), o.data.shelters, 'shelter_id', 'name');

      // Hide the "+ Add Animal" button for Global Admin
      const addBtn = document.querySelector('a[href="/admin/animal-form.html"]');
      if (addBtn) addBtn.classList.add('d-none');
    }
  }

  document.getElementById('filters').addEventListener('submit', (e) => {
    e.preventDefault();
    load();
  });
  ['f-status', 'f-species', 'f-shelter', 'f-due'].forEach((id) => {
    document.getElementById(id).addEventListener('change', load);
  });
  document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('filters').reset();
    load();
  });

  load();
}

start();