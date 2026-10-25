// Admin staff page.
// Shelter admin: sees their shelter's staff, adds and edits Vets and Caretakers.
// Global Admin: sees all staff (read only), can filter by shelter.
let me = null;
let editId = null;       // staff member being edited (null = adding)

const $ = (x) => document.getElementById(x);

// add one <td>. Text goes in with textContent, so it can never run as HTML.
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

function resetForm() {
  editId = null;
  $('f').reset();
  if (me && me.role === 'Global Admin') {
    $('form-title').textContent = 'Add Shelter Admin';
    $('form-desc').textContent = 'Create a login for a local shelter admin. Choose their shelter and set a temporary password.';
    $('save').textContent = 'Add Shelter Admin';
  } else {
    $('form-title').textContent = 'Add staff member';
    $('form-desc').textContent = 'Staff added here do not get a login. They appear in the "Examined by" list for medical records.';
    $('save').textContent = 'Add';
  }
  $('cancel').classList.add('d-none');
  $('err').textContent = '';
}

function startEdit(x) {
  editId = x.staff_id;
  $('name').value = x.name;
  $('role').value = x.role;
  $('email').value = x.email;
  $('phone').value = x.phone || '';
  $('form-title').textContent = 'Edit staff member';
  $('save').textContent = 'Update';
  $('cancel').classList.remove('d-none');
  $('err').textContent = '';
  $('f').scrollIntoView({ behavior: 'smooth' });
}

async function load() {
  const p = new URLSearchParams();
  if (me.role === 'Global Admin' && $('f-shelter') && $('f-shelter').value) p.set('shelter_id', $('f-shelter').value);

  const r = await api('/api/admin/staff?' + p.toString());
  $('rows').innerHTML = '';
  if (!r.ok) {
    showMsg(r.data.error || 'Could not load staff', false);
    return;
  }

  r.data.forEach((x) => {
    const tr = document.createElement('tr');
    addCell(tr, x.name);
    addCell(tr, x.role);
    addCell(tr, x.email);
    addCell(tr, x.phone || '-');
    addCell(tr, x.shelter || '-');
    addCell(tr, x.can_login ? 'Yes' : 'No');

    // only a shelter admin can edit, and only Vets and Caretakers
    const canEdit = me.role === 'Admin' && (x.role === 'Vet' || x.role === 'Caretaker');
    if (canEdit) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm btn-outline-primary';
      b.textContent = 'Edit';
      b.addEventListener('click', () => startEdit(x));
      addCell(tr, b);
    } else {
      addCell(tr, '');
    }
    $('rows').appendChild(tr);
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

  if (me.role === 'Global Admin') {
    const sTab = document.getElementById('shelters-tab');
    if (sTab) sTab.classList.remove('d-none');
    // Show table shelter filter
    $('shelter-box').classList.remove('d-none');
    if (o.ok) {
      o.data.shelters.forEach((s) => {
        const op1 = document.createElement('option');
        op1.value = s.shelter_id;
        op1.textContent = s.name;
        $('f-shelter').appendChild(op1);

        const op2 = document.createElement('option');
        op2.value = s.shelter_id;
        op2.textContent = s.name;
        $('staff-shelter').appendChild(op2);
      });
    }
    $('f-shelter').addEventListener('change', load);

    // Configure form for adding Shelter Admins
    $('f').classList.remove('d-none');
    $('role-input-group').classList.add('d-none');
    $('shelter-input-group').classList.remove('d-none');
    $('password-input-group').classList.remove('d-none');
    $('form-title').textContent = 'Add Shelter Admin';
    $('form-desc').textContent = 'Create a login for a local shelter admin. Choose their shelter and set a temporary password.';
    $('save').textContent = 'Add Shelter Admin';
  } else {
    // Shelter Admin: adds local staff (Vet, Caretaker)
    $('f').classList.remove('d-none');
    $('role-input-group').classList.remove('d-none');
    $('shelter-input-group').classList.add('d-none');
    $('password-input-group').classList.add('d-none');
  }

  $('cancel').addEventListener('click', resetForm);

  $('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('err').textContent = '';

    if (me.role === 'Global Admin') {
      const shelterId = $('staff-shelter').value;
      const pass = $('staff-password').value;

      if (!shelterId) {
        $('err').textContent = 'Please choose a shelter.';
        return;
      }
      if (!pass || pass.length < 6) {
        $('err').textContent = 'Temporary password must be at least 6 characters.';
        return;
      }

      const b = {
        name: $('name').value.trim(),
        role: 'Admin',
        email: $('email').value.trim(),
        phone: $('phone').value.trim(),
        shelter_id: Number(shelterId),
        password: pass
      };

      const r = await api('/api/admin/staff', 'POST', b);
      if (!r.ok) {
        $('err').textContent = r.data.error || 'Could not save';
        return;
      }

      showMsg('Shelter Admin created with login access. Give them their email and password.', true);
      resetForm();
      load();
      return;
    }

    // Local Shelter Admin:
    const b = {
      name: $('name').value.trim(),
      role: $('role').value,
      email: $('email').value.trim(),
      phone: $('phone').value.trim()
    };
    const r = editId
      ? await api('/api/admin/staff/' + editId, 'PUT', b)
      : await api('/api/admin/staff', 'POST', b);
    if (!r.ok) {
      $('err').textContent = r.data.error || 'Could not save';
      return;
    }
    showMsg(editId ? 'Staff member updated.' : 'Staff member added.', true);
    resetForm();
    load();
  });

  load();
}

start();