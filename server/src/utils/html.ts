/**
 * Escapes text for safe interpolation into HTML.
 *
 * Every user-supplied value that reaches an email or a server-rendered page goes through
 * this: a student's name is attacker-controlled, and an unescaped one would let anyone
 * who registers with a stranger's address send that stranger our branded HTML.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A complete, self-contained HTML page for the few screens the API renders itself:
 * email verification results, account deletion and the legal pages. No scripts, so it
 * runs under the default Content-Security-Policy that helmet sets.
 *
 * `bodyHtml` must already be safe; `title` is escaped here.
 */
export function renderPage(title: string, bodyHtml: string, appName: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} · ${escapeHtml(appName)}</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --text:#14151a; --muted:#5f6370; --accent:#4f46e5; --border:#e2e4e9; --danger:#c62828; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0e0f13; --card:#17191f; --text:#ecedf1; --muted:#9096a3; --accent:#818cf8; --border:#2a2d36; --danger:#f87171; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 16px 64px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:28px; }
  h1 { font-size:24px; line-height:1.3; margin:0 0 8px; }
  h2 { font-size:18px; margin:28px 0 8px; }
  p, li { color:var(--text); }
  .muted { color:var(--muted); font-size:14px; }
  a { color:var(--accent); }
  /* Buttons keep fixed, darker fills: the lighter dark-theme accents are too pale under white text. */
  .button { display:inline-block; background:#4f46e5; color:#fff; padding:11px 20px; border-radius:10px; text-decoration:none; font-weight:600; border:0; font-size:16px; cursor:pointer; }
  .danger { background:#dc2626; }
  label { display:block; font-weight:600; margin:16px 0 6px; }
  input { width:100%; font:inherit; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg); color:var(--text); }
  .alert { padding:12px 14px; border-radius:10px; border:1px solid var(--danger); color:var(--danger); margin:16px 0; }
  .brand { font-weight:700; color:var(--muted); font-size:14px; margin-bottom:16px; }
</style>
</head>
<body><main><div class="card"><div class="brand">${escapeHtml(appName)}</div>${bodyHtml}</div></main></body>
</html>`;
}
