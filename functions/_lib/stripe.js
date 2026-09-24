// Minimal Stripe REST client for Cloudflare Pages Functions (no SDK, no Node APIs).
// Secrets come from the Pages project settings: STRIPE_SECRET_KEY (never in the code).

const API = 'https://api.stripe.com/v1/';

// How long the download link of a paid order stays valid.
export const DOWNLOAD_DAYS = 30;

// { a: { b: [ { c: 1 } ] } } -> a[b][0][c]=1
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? form(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const init = { method, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } };
  let url = API + path;
  if (params && method === 'GET') url += '?' + form(params).toString();
  else if (params) { init.headers['Content-Type'] = 'application/x-www-form-urlencoded'; init.body = form(params).toString(); }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) { const err = new Error((data.error && data.error.message) || `Stripe ${res.status}`); err.status = res.status; throw err; }
  return data;
}

// Checkout Session ids are unguessable ("cs_live_…" / "cs_test_…").
export const validSessionId = id => typeof id === 'string' && /^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(id);

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

// Same-origin only: the site and its API share one domain.
export function sameOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const self = new URL(request.url).origin;
  const allowed = [self, env.SITE_URL].filter(Boolean).map(u => u.replace(/\/$/, ''));
  return allowed.includes(origin);
}

export const siteUrl = (request, env) => (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
