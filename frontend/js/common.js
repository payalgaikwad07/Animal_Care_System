// Small helper to call the API.
// Returns { ok: true/false, data: the JSON reply }
async function api(url, method, body) {
  const opt = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data: data };
}

// Load the navbar, then show Login/Register or the user's name + Logout.
async function loadNav() {
  const html = await (await fetch('/navbar.html')).text();
  document.getElementById('nav').innerHTML = html;

  const box = document.getElementById('auth');
  const me = await api('/api/me');

  if (me.ok && me.data.loggedIn) {
    const adminLink = (me.data.role === 'Admin' || me.data.role === 'Global Admin')
      ? '<a class="btn btn-warning btn-sm me-2" href="/admin/index.html">Admin Dashboard</a>'
      : '';
    box.innerHTML =
      adminLink +
      '<span id="uname" class="text-white me-2"></span>' +
      '<button class="btn btn-outline-light btn-sm" onclick="logout()">Logout</button>';
    document.getElementById('uname').textContent = me.data.name;
  } else {
    box.innerHTML = '<a class="btn btn-outline-light btn-sm" href="/login.html">Login / Register</a>';
  }
}

async function logout() {
  await api('/api/logout', 'POST');
  window.location = '/index.html';
}

loadNav();