// Admin requests page: list adoption and foster requests, approve / reject / end foster.
// Shelter admins can act on requests. The Global Admin can only look.
let me = null;
let canAct = false;

const $ = (x) => document.getElementById(x);
const d10 = (x) => (x ? String(x).slice(0, 10) : '');

const COLORS = {
  'Pending': 'bg-warning text-dark',
  'Approved': 'bg-success',
  'Rejected': 'bg-danger',
  'Ended': 'bg-secondary',
  'Available': 'bg-success',
  'Under Treatment': 'bg-warning text-dark',
  'Fostered': 'bg-info text-dark',
  'Adopted': 'bg-secondary'
};

function badge(text) {
  const b = document.createElement('span');
  b.className = 'badge ' + (COLORS[text] || 'bg-light text-dark');
  b.textContent = text;
  return b;
}

// a small line of text inside a cell
function line(text, cls) {
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.textContent = text;
  return div;
}

// add one <td>. Text goes in with textContent, so it can never run as HTML.
function addCell(tr, content) {
  const td = document.createElement('td');
  if (Array.isArray(content)) content.forEach((c) => td.appendChild(c));
  else if (content instanceof Node) td.appendChild(content);
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

function button(text, cls, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-sm me-1 ' + cls;
  b.textContent = text;
  b.addEventListener('click', fn);
  return b;
}

// approve / reject / end
async function act(r, action) {
  let ask;
  if (action === 'approve') {
    ask = 'Approve this ' + r.type + ' request for ' + r.animal + '?\nOther pending requests for this animal will be rejected.';
  } else if (action === 'reject') {
    ask = 'Reject this ' + r.type + ' request for ' + r.animal + '?';
  } else {
    ask = 'End this foster? ' + r.animal + ' will become Available again.';
  }
  if (!confirm(ask)) return;

  const res = await api('/api/admin/requests/' + r.type + '/' + r.id + '/' + action, 'POST');
  if (res.ok) {
    let text = action === 'approve' ? 'Approved.' : action === 'reject' ? 'Rejected.' : 'Foster ended.';
    if (res.data.auto_rejected) {
      text += ' ' + res.data.auto_rejected + ' other pending request(s) for this animal were rejected.';
    }
    showMsg(text, true);
  } else {
    showMsg(res.data.error || 'Something went wrong', false);
  }
  load();   // always refresh, so the page shows what is really in the database
}

async function load() {
  const p = new URLSearchParams();
  if ($('f-type').value) p.set('type', $('f-type').value);
  if ($('f-status').value) p.set('status', $('f-status').value);
  if (me.role === 'Global Admin' && $('f-shelter').value) p.set('shelter_id', $('f-shelter').value);

  const r = await api('/api/admin/requests?' + p.toString());
  $('rows').innerHTML = '';
  if (!r.ok) {
    showMsg(r.data.error || 'Could not load requests', false);
    $('count').textContent = '';
    return;
  }

  $('count').textContent = r.data.length ? r.data.length + ' request(s)' : 'No requests found.';

  r.data.forEach((x) => {
    const tr = document.createElement('tr');
    addCell(tr, badge(x.type === 'adoption' ? 'Adoption' : 'Foster'));
    addCell(tr, [line(x.animal, 'fw-semibold'), badge(x.animal_status)]);
    addCell(tr, [line(x.applicant), line(x.address || '', 'small text-muted')]);
    addCell(tr, [line(x.email), line(x.phone || '', 'small text-muted')]);
    addCell(tr, d10(x.request_date));

    // details: dates and notes
    const det = [];
    if (x.type === 'adoption' && x.adopted_date) det.push(line('Adopted on ' + d10(x.adopted_date)));
    if (x.type === 'foster' && (x.start_date || x.end_date)) {
      det.push(line('From ' + (d10(x.start_date) || '?') + ' to ' + (d10(x.end_date) || '?')));
    }
    if (x.notes) det.push(line(x.notes, 'small text-muted'));
    addCell(tr, det.length ? det : '-');

    addCell(tr, badge(x.status));
    addCell(tr, x.shelter);

    // action buttons: shelter admins only
    const acts = [];
    if (canAct && x.status === 'Pending') {
      acts.push(button('Approve', 'btn-success', () => act(x, 'approve')));
      acts.push(button('Reject', 'btn-outline-danger', () => act(x, 'reject')));
    }
    if (canAct && x.type === 'foster' && x.status === 'Approved') {
      acts.push(button('End foster', 'btn-outline-primary', () => act(x, 'end')));
    }
    addCell(tr, acts);

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
  canAct = me.role === 'Admin';

  if (me.role === 'Global Admin') {
    const sTab = document.getElementById('shelters-tab');
    if (sTab) sTab.classList.remove('d-none');
    const o = await api('/api/admin/options');
    if (o.ok) {
      $('shelter-box').classList.remove('d-none');
      o.data.shelters.forEach((s) => {
        const op = document.createElement('option');
        op.value = s.shelter_id;
        op.textContent = s.name;
        $('f-shelter').appendChild(op);
      });
    }
  }

  $('filters').addEventListener('submit', (e) => e.preventDefault());
  ['f-type', 'f-status', 'f-shelter'].forEach((id) => {
    $(id).addEventListener('change', () => { showMsg(''); load(); });
  });

  load();
}

start();