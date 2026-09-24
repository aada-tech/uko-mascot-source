// GET /api/download?session_id=cs_… — streams the pack after checking the payment.
// The ZIP lives in /private/ (deployed with the site but never served directly:
// functions/private/[[path]].js answers 404 there); it is read through the
// ASSETS binding, which bypasses the functions router.
import { stripe, json, validSessionId, DOWNLOAD_DAYS } from '../_lib/stripe.js';

export const PACK_FILE = 'Uko-Mascot-Pack.zip';

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('session_id');
  if (!validSessionId(id)) return json({ error: 'Lien de téléchargement invalide.' }, 400);
  let session;
  try {
    session = await stripe(env, 'GET', `checkout/sessions/${id}`);
  } catch (err) {
    console.error('[download]', err.message);
    return json({ error: err.status === 404 ? 'Commande introuvable.' : 'Téléchargement impossible pour le moment.' }, err.status === 404 ? 404 : 502);
  }
  if (session.payment_status !== 'paid') return json({ error: 'Paiement non confirmé.' }, 402);
  if ((Date.now() / 1000 - session.created) / 86400 > DOWNLOAD_DAYS) {
    return json({ error: `Lien expiré (${DOWNLOAD_DAYS} jours). Écris au support avec l’e-mail de ta commande : on t’envoie un nouveau lien.` }, 410);
  }
  const file = await env.ASSETS.fetch(new URL(`/private/${PACK_FILE}`, request.url));
  if (!file.ok) { console.error('[download] pack missing', file.status); return json({ error: 'Fichier indisponible, contacte le support.' }, 500); }
  return new Response(file.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${PACK_FILE}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
