// Global Admin shelters management page
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

async function load() {
  const r = await api('/api/admin/shelters');
  $('rows').innerHTML = '';
  if (!r.ok) {
    showMsg(r.data.error || 'Could not load shelters', false);
    return;
  }

  r.data.forEach((s) => {
    const tr = document.createElement('tr');
    addCell(tr, s.name);
    addCell(tr, s.city);
    addCell(tr, s.address);
    addCell(tr, s.phone);
    addCell(tr, s.email || '-');
    addCell(tr, s.capacity);

    // Animals count badge
    const animSpan = document.createElement('span');
    animSpan.className = 'badge bg-secondary';
    animSpan.textContent = s.animal_count + ' animals';
    addCell(tr, animSpan);

    // Admin status
    if (s.admin_name) {
      const adminSpan = document.createElement('span');
      adminSpan.className = 'badge bg-success';
      adminSpan.textContent = s.admin_name;
      adminSpan.title = s.admin_email || '';
      addCell(tr, adminSpan);

      const tdAction = document.createElement('td');
      tdAction.innerHTML = '<span class="text-muted small">Assigned</span>';
      tr.appendChild(tdAction);
    } else {
      const unassignedSpan = document.createElement('span');
      unassignedSpan.className = 'badge bg-warning text-dark';
      unassignedSpan.textContent = 'No Admin';
      addCell(tr, unassignedSpan);

      const link = document.createElement('a');
      link.className = 'btn btn-sm btn-outline-primary';
      link.href = '/admin/staff.html';
      link.textContent = 'Assign Admin';
      addCell(tr, link);
    }

    $('rows').appendChild(tr);
  });
}

async function start() {
  const m = await api('/api/me');
  if (!m.data.loggedIn || m.data.role !== 'Global Admin') {
    window.location = '/admin/index.html';
    return;
  }
  me = m.data;

  $('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('err').textContent = '';

    const b = {
      name: $('name').value.trim(),
      city: $('city').value.trim(),
      address: $('address').value.trim(),
      phone: $('phone').value.trim(),
      email: $('email').value.trim(),
      capacity: Number($('capacity').value)
    };

    const r = await api('/api/admin/shelters', 'POST', b);
    if (!r.ok) {
      $('err').textContent = r.data.error || 'Could not add shelter';
      return;
    }

    showMsg('Shelter added successfully! You can now assign a shelter admin in the Staff tab.', true);
    $('f').reset();
    $('capacity').value = 50;
    load();
  });

  load();
}

start();
