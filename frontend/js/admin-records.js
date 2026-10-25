// Medical and vaccination history on the edit page (admin/animal-form.html?id=5).
// Shelter admins can add and edit records. The Global Admin can only read them.
// Wrapped in a function so its names do not clash with admin-animal-form.js.
(async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return;                                   // add mode: no history yet

  const $ = (x) => document.getElementById(x);
  const today = new Date().toLocaleDateString('en-CA');   // YYYY-MM-DD, local time
  let medId = null;                                  // record being edited (null = adding)
  let vacId = null;

  const me = await api('/api/me');
  const canEdit = me.data.loggedIn && me.data.role === 'Admin';

  // the page section (fixed text only, no data from the database goes in here)
  $('records').innerHTML = `
    <h5>Medical history</h5>
    <table class="table table-sm bg-white">
      <thead><tr><th>Date</th><th>Diagnosis</th><th>Treatment</th><th>Examined by</th><th></th></tr></thead>
      <tbody id="med-rows"></tbody>
    </table>
    <form id="med-form" class="card card-body mb-4 d-none">
      <h6 id="med-title">Add medical record</h6>
      <div id="med-err" class="text-danger"></div>
      <div class="row g-2">
        <div class="col-md-3"><input type="date" id="m-date" class="form-control" required></div>
        <div class="col-md-5"><input type="text" id="m-diag" class="form-control" placeholder="Diagnosis" maxlength="255" required></div>
        <div class="col-md-4"><select id="m-staff" class="form-select"><option value="">Examined by: not recorded</option></select></div>
        <div class="col-md-8"><input type="text" id="m-treat" class="form-control" placeholder="Treatment" maxlength="255"></div>
        <div class="col-md-4">
          <button class="btn btn-primary" id="m-save">Add</button>
          <button type="button" class="btn btn-outline-secondary d-none" id="m-cancel">Cancel</button>
        </div>
      </div>
    </form>

    <h5 class="mt-4">Vaccinations</h5>
    <table class="table table-sm bg-white">
      <thead><tr><th>Vaccine</th><th>Date given</th><th>Next due</th><th></th></tr></thead>
      <tbody id="vac-rows"></tbody>
    </table>
    <form id="vac-form" class="card card-body mb-4 d-none">
      <h6 id="vac-title">Add vaccination</h6>
      <div id="vac-err" class="text-danger"></div>
      <div class="row g-2">
        <div class="col-md-4"><input type="text" id="vac-name" class="form-control" placeholder="Vaccine name" maxlength="100" required></div>
        <div class="col-md-3"><input type="date" id="vac-given" class="form-control" title="Date given" required></div>
        <div class="col-md-3"><input type="date" id="vac-next" class="form-control" title="Next due date"></div>
        <div class="col-md-2">
          <button class="btn btn-primary" id="vac-save">Add</button>
          <button type="button" class="btn btn-outline-secondary d-none" id="vac-cancel">Cancel</button>
        </div>
      </div>
    </form>`;

  const d10 = (x) => (x ? String(x).slice(0, 10) : '-');

  // add one <td>; text goes in with textContent so it can never run as HTML
  function cell(tr, content) {
    const td = document.createElement('td');
    if (content instanceof Node) td.appendChild(content);
    else td.textContent = content;
    tr.appendChild(td);
  }

  function editButton(fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm btn-outline-primary';
    b.textContent = 'Edit';
    b.addEventListener('click', fn);
    return b;
  }

  // ---------- show the two lists ----------
  async function load() {
    const r = await api('/api/admin/animals/' + id);
    if (!r.ok) return;                               // e.g. "Animal not found"
    $('records').classList.remove('d-none');
    $('med-rows').innerHTML = '';
    $('vac-rows').innerHTML = '';

    r.data.medical.forEach((x) => {
      const tr = document.createElement('tr');
      cell(tr, d10(x.visit_date));
      cell(tr, x.diagnosis);
      cell(tr, x.treatment || '-');
      cell(tr, x.examined_by || '-');
      cell(tr, canEdit ? editButton(() => startMedEdit(x)) : '');
      $('med-rows').appendChild(tr);
    });

    r.data.vaccines.forEach((x) => {
      const tr = document.createElement('tr');
      cell(tr, x.vaccine_name);
      cell(tr, d10(x.date_given));
      cell(tr, d10(x.next_due_date));
      cell(tr, canEdit ? editButton(() => startVacEdit(x)) : '');
      $('vac-rows').appendChild(tr);
    });
  }

  // ---------- medical form ----------
  function resetMed() {
    medId = null;
    $('med-form').reset();
    $('m-date').value = today;
    $('med-title').textContent = 'Add medical record';
    $('m-save').textContent = 'Add';
    $('m-cancel').classList.add('d-none');
    $('med-err').textContent = '';
  }

  function startMedEdit(x) {
    medId = x.record_id;
    $('m-date').value = d10(x.visit_date);
    $('m-diag').value = x.diagnosis;
    $('m-treat').value = x.treatment || '';
    $('m-staff').value = x.staff_id || '';
    $('med-title').textContent = 'Edit medical record';
    $('m-save').textContent = 'Update';
    $('m-cancel').classList.remove('d-none');
    $('med-err').textContent = '';
    $('med-form').scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- vaccination form ----------
  function resetVac() {
    vacId = null;
    $('vac-form').reset();
    $('vac-given').value = today;
    $('vac-title').textContent = 'Add vaccination';
    $('vac-save').textContent = 'Add';
    $('vac-cancel').classList.add('d-none');
    $('vac-err').textContent = '';
  }

  function startVacEdit(x) {
    vacId = x.vaccination_id;
    $('vac-name').value = x.vaccine_name;
    $('vac-given').value = d10(x.date_given);
    $('vac-next').value = x.next_due_date ? d10(x.next_due_date) : '';
    $('vac-title').textContent = 'Edit vaccination';
    $('vac-save').textContent = 'Update';
    $('vac-cancel').classList.remove('d-none');
    $('vac-err').textContent = '';
    $('vac-form').scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- forms are for shelter admins only ----------
  if (canEdit) {
    const o = await api('/api/admin/options');
    if (o.ok) {
      o.data.staff.forEach((s) => {
        const op = document.createElement('option');
        op.value = s.staff_id;
        op.textContent = s.name + ' (' + s.role + ')';
        $('m-staff').appendChild(op);
      });
    }
    $('med-form').classList.remove('d-none');
    $('vac-form').classList.remove('d-none');
    resetMed();
    resetVac();

    $('m-cancel').addEventListener('click', resetMed);
    $('vac-cancel').addEventListener('click', resetVac);

    $('med-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('med-err').textContent = '';
      const b = {
        visit_date: $('m-date').value,
        diagnosis: $('m-diag').value.trim(),
        treatment: $('m-treat').value.trim(),
        staff_id: $('m-staff').value || null
      };
      const r = medId
        ? await api('/api/admin/medical/' + medId, 'PUT', b)
        : await api('/api/admin/animals/' + id + '/medical', 'POST', b);
      if (!r.ok) {
        $('med-err').textContent = r.data.error || 'Could not save';
        return;
      }
      resetMed();
      load();
    });

    $('vac-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('vac-err').textContent = '';
      const b = {
        vaccine_name: $('vac-name').value.trim(),
        date_given: $('vac-given').value,
        next_due_date: $('vac-next').value || null
      };
      const r = vacId
        ? await api('/api/admin/vaccines/' + vacId, 'PUT', b)
        : await api('/api/admin/animals/' + id + '/vaccines', 'POST', b);
      if (!r.ok) {
        $('vac-err').textContent = r.data.error || 'Could not save';
        return;
      }
      resetVac();
      load();
    });
  }

  load();
})();