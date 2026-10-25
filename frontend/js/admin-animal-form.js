// Admin add / edit animal page.
// /admin/animal-form.html          -> add a new animal
// /admin/animal-form.html?id=5     -> view and edit animal 5
const id = new URLSearchParams(window.location.search).get('id');
const edit = !!id;
const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
let me = null;

const $ = (x) => document.getElementById(x);

function fillStaff(list) {
  $('staff').innerHTML = '<option value="">Not recorded</option>';
  list.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.staff_id;
    o.textContent = s.name + ' (' + s.role + ')';
    $('staff').appendChild(o);
  });
}

// one row of vaccine inputs
function addVac() {
  const row = document.createElement('div');
  row.className = 'row g-2 mb-2 vac-row';
  row.innerHTML =
    '<div class="col-md-4"><input type="text" class="form-control v-name" placeholder="Vaccine name" maxlength="100"></div>' +
    '<div class="col-md-3"><input type="date" class="form-control v-given" title="Date given"></div>' +
    '<div class="col-md-3"><input type="date" class="form-control v-next" title="Next due date"></div>' +
    '<div class="col-md-2"><button type="button" class="btn btn-outline-danger w-100">Remove</button></div>';
  row.querySelector('.v-given').value = today;
  row.querySelector('button').addEventListener('click', () => row.remove());
  $('vac').appendChild(row);
}

async function loadAnimal() {
  const r = await api('/api/admin/animals/' + id);
  if (!r.ok) {
    $('err').textContent = r.data.error || 'Animal not found';
    $('f').classList.add('d-none');
    return;
  }
  const a = r.data;
  $('name').value = a.name;
  $('species').value = a.species;
  $('breed').value = a.breed || '';
  $('age').value = a.age_months;
  $('gender').value = a.gender;
  $('intake').value = String(a.intake_date).slice(0, 10);
  $('intake').disabled = true;          // the server does not change the intake date
  $('image').value = a.image_url || '';
  $('notes').value = a.notes || '';

  // Adopted / Fostered animals: status is locked here
  if (a.status === 'Adopted' || a.status === 'Fostered') {
    const o = document.createElement('option');
    o.textContent = a.status;
    $('status').appendChild(o);
    $('status').value = a.status;
    $('status').disabled = true;
    $('status-note').classList.remove('d-none');
  } else {
    $('status').value = a.status;
  }

  // shelter (read-only text in edit mode)
  $('shelter-box').classList.remove('d-none');
  $('shelter').innerHTML = '';
  const so = document.createElement('option');
  so.textContent = a.shelter;
  $('shelter').appendChild(so);
  $('shelter').disabled = true;

  
}

async function start() {
  const m = await api('/api/me');
  if (!m.data.loggedIn || (m.data.role !== 'Admin' && m.data.role !== 'Global Admin')) {
    window.location = '/login.html';
    return;
  }
  me = m.data;

  // Global Admin cannot add animals directly; only shelter admins perform intake
  if (!edit && me.role === 'Global Admin') {
    alert('Global Admin cannot add animals. Only shelter admins perform intake.');
    window.location = '/admin/index.html';
    return;
  }

  const o = await api('/api/admin/options');
  if (o.ok) {
    o.data.species.forEach((s) => {
      const op = document.createElement('option');
      op.value = s;
      $('species-list').appendChild(op);
    });
  }

  if (edit) {
    $('title').textContent = 'Edit Animal';
    $('add-only').classList.add('d-none');
    loadAnimal();
    return;
  }

  // ----- add mode -----
  $('intake').value = today;
  $('visit').value = today;
  addVac();
  $('add-vac').addEventListener('click', addVac);

  if (me.role === 'Global Admin') {
    // the Global Admin picks the shelter, then the "examined by" list follows it
    $('shelter-box').classList.remove('d-none');
    $('shelter').required = true;
    o.data.shelters.forEach((s) => {
      const op = document.createElement('option');
      op.value = s.shelter_id;
      op.textContent = s.name;
      $('shelter').appendChild(op);
    });
    $('shelter').addEventListener('change', async () => {
      if (!$('shelter').value) return fillStaff([]);
      const r = await api('/api/admin/options?shelter_id=' + $('shelter').value);
      fillStaff(r.ok ? r.data.staff : []);
    });
  } else {
    fillStaff(o.data.staff);
  }
}

$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('err').textContent = '';

  const b = {
    name: $('name').value.trim(),
    species: $('species').value.trim(),
    breed: $('breed').value.trim(),
    age_months: $('age').value,
    gender: $('gender').value,
    status: $('status').value,
    image_url: $('image').value.trim(),
    notes: $('notes').value.trim()
  };

  let r;
  if (edit) {
    r = await api('/api/admin/animals/' + id, 'PUT', b);
  } else {
    b.intake_date = $('intake').value;
    if (me.role === 'Global Admin') b.shelter_id = $('shelter').value;

    if ($('diag').value.trim()) {
      b.medical = {
        visit_date: $('visit').value,
        diagnosis: $('diag').value.trim(),
        treatment: $('treat').value.trim(),
        staff_id: $('staff').value || null
      };
    }

    b.vaccines = [];
    document.querySelectorAll('.vac-row').forEach((row) => {
      const n = row.querySelector('.v-name').value.trim();
      if (n) {
        b.vaccines.push({
          vaccine_name: n,
          date_given: row.querySelector('.v-given').value,
          next_due_date: row.querySelector('.v-next').value || null
        });
      }
    });

    r = await api('/api/admin/animals', 'POST', b);
  }

  if (!r.ok) {
    $('err').textContent = r.data.error || 'Could not save';
    window.scrollTo(0, 0);
    return;
  }
  window.location = '/admin/index.html';
});

start();