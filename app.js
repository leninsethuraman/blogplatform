/* Inkwell – single-page frontend (vanilla JS, hash routing) */
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
};

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token && { Authorization: 'Bearer ' + state.token }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(true);
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function setSession(data) {
  state.token = data.token; state.user = data.user;
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}
function logout(expired) {
  state.token = null; state.user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  if (expired) toast('Session expired. Please log in again.');
  location.hash = '#/login';
  renderNav();
}

function renderNav() {
  nav.innerHTML = state.user
    ? `<span class="who">${esc(state.user.username)}</span>
       <a class="btn primary" href="#/new">New post</a>
       <button class="btn" id="logout">Log out</button>`
    : `<a class="btn" href="#/login">Log in</a><a class="btn primary" href="#/register">Sign up</a>`;
  document.getElementById('logout')?.addEventListener('click', () => { logout(); toast('Logged out.'); });
}

// ---------- views ----------
async function listView() {
  app.innerHTML = '<h1>Latest posts</h1><div id="list">Loading…</div>';
  const posts = await api('/posts');
  document.getElementById('list').innerHTML = posts.length
    ? posts.map((p) => `
        <a class="post-item" href="#/post/${p.id}">
          <h3>${esc(p.title)}</h3>
          <div class="meta">${esc(p.author)} · ${fmt(p.created_at)} · ${p.comment_count} comment${p.comment_count === 1 ? '' : 's'}</div>
          <p>${esc(p.content.slice(0, 160))}${p.content.length > 160 ? '…' : ''}</p>
        </a>`).join('')
    : `<p class="empty">No posts yet. ${state.user ? '<a href="#/new">Write the first one.</a>' : '<a href="#/register">Sign up</a> to write the first one.'}</p>`;
}

async function postView(id) {
  app.innerHTML = 'Loading…';
  const [post, comments] = await Promise.all([api('/posts/' + id), api(`/posts/${id}/comments`)]);
  const mine = state.user && state.user.id === post.user_id;
  app.innerHTML = `
    <a href="#/">← All posts</a>
    <h1>${esc(post.title)}</h1>
    <div class="meta">${esc(post.author)} · ${fmt(post.created_at)}${post.updated_at !== post.created_at ? ' · edited' : ''}</div>
    ${mine ? `<div class="actions"><a class="btn small" href="#/edit/${post.id}">Edit</a>
              <button class="btn small danger" id="del">Delete</button></div>` : ''}
    <div class="article">${esc(post.content)}</div>
    <h2>${comments.length} comment${comments.length === 1 ? '' : 's'}</h2>
    <div id="comments"></div>
    ${state.user
      ? `<form id="cform" class="wide">
           <label for="body">Add a comment</label>
           <textarea id="body" class="short" maxlength="1000" required></textarea>
           <div class="error" id="err"></div>
           <button class="btn primary">Post comment</button>
         </form>`
      : `<p class="empty"><a href="#/login">Log in</a> to join the discussion.</p>`}`;

  const draw = () => {
    document.getElementById('comments').innerHTML = comments.length
      ? comments.map((c) => `
          <div class="comment">
            <div class="head"><span class="meta"><strong>${esc(c.author)}</strong> · ${fmt(c.created_at)}</span>
              ${state.user && (state.user.id === c.user_id || mine) ? `<button class="btn small danger" data-del="${c.id}">Delete</button>` : ''}
            </div><p>${esc(c.body)}</p>
          </div>`).join('')
      : '<p class="empty">No comments yet.</p>';
  };
  draw();

  document.getElementById('comments').addEventListener('click', async (e) => {
    const cid = e.target.dataset.del;
    if (!cid) return;
    try {
      await api('/comments/' + cid, { method: 'DELETE' });
      comments.splice(comments.findIndex((c) => c.id == cid), 1);
      app.querySelector('h2').textContent = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;
      draw(); toast('Comment deleted.');
    } catch (err) { toast(err.message); }
  });

  document.getElementById('cform')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const c = await api(`/posts/${id}/comments`, { method: 'POST', body: { body: e.target.body.value } });
      comments.push(c); e.target.reset();
      app.querySelector('h2').textContent = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;
      draw(); toast('Comment posted.');
    } catch (err) { document.getElementById('err').textContent = err.message; }
  });

  document.getElementById('del')?.addEventListener('click', async () => {
    if (!confirm('Delete this post and all its comments?')) return;
    try { await api('/posts/' + id, { method: 'DELETE' }); toast('Post deleted.'); location.hash = '#/'; }
    catch (err) { toast(err.message); }
  });
}

async function editorView(id) {
  if (!state.user) { location.hash = '#/login'; return; }
  const post = id ? await api('/posts/' + id) : { title: '', content: '' };
  if (id && post.user_id !== state.user.id) { toast('You can only edit your own posts.'); location.hash = '#/'; return; }
  app.innerHTML = `
    <h1>${id ? 'Edit post' : 'New post'}</h1>
    <form id="pform" class="card wide">
      <label for="title">Title</label>
      <input id="title" maxlength="150" required value="${esc(post.title)}" />
      <label for="content">Content</label>
      <textarea id="content" required>${esc(post.content)}</textarea>
      <div class="error" id="err"></div>
      <button class="btn primary">${id ? 'Save changes' : 'Publish'}</button>
    </form>`;
  document.getElementById('pform').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const saved = await api(id ? '/posts/' + id : '/posts', {
        method: id ? 'PUT' : 'POST',
        body: { title: e.target.title.value, content: e.target.content.value },
      });
      toast(id ? 'Changes saved.' : 'Published.');
      location.hash = '#/post/' + saved.id;
    } catch (err) { document.getElementById('err').textContent = err.message; }
  });
}

function authView(mode) {
  const reg = mode === 'register';
  app.innerHTML = `
    <h1>${reg ? 'Create your account' : 'Log in'}</h1>
    <form id="aform" class="card">
      ${reg ? '<label for="username">Username</label><input id="username" required minlength="3" autocomplete="username" />' : ''}
      <label for="email">Email</label><input id="email" type="email" required autocomplete="email" />
      <label for="password">Password</label>
      <input id="password" type="password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}" />
      <div class="error" id="err"></div>
      <button class="btn primary">${reg ? 'Sign up' : 'Log in'}</button>
    </form>
    <p class="meta">${reg ? 'Already registered? <a href="#/login">Log in</a>' : 'New here? <a href="#/register">Create an account</a>'}</p>`;
  document.getElementById('aform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const data = await api('/auth/' + mode, {
        method: 'POST',
        body: { email: f.email.value, password: f.password.value, ...(reg && { username: f.username.value }) },
      });
      setSession(data); renderNav(); toast(reg ? 'Account created.' : 'Welcome back.');
      location.hash = '#/';
    } catch (err) { document.getElementById('err').textContent = err.message; }
  });
}

// ---------- router ----------
async function route() {
  renderNav();
  const [, page, id] = location.hash.split('/');
  try {
    if (page === 'post' && id) await postView(id);
    else if (page === 'new') await editorView();
    else if (page === 'edit' && id) await editorView(id);
    else if (page === 'login') authView('login');
    else if (page === 'register') authView('register');
    else await listView();
  } catch (err) {
    app.innerHTML = `<p class="empty">${esc(err.message)} <a href="#/">Back to posts</a></p>`;
  }
}
window.addEventListener('hashchange', route);
route();
