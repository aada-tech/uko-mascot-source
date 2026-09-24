// GET /api/verify-session?session_id=cs_… — confirms a paid Checkout Session
// and returns what the thank-you page needs (never card data).
import { stripe, json, validSessionId, DOWNLOAD_DAYS } from '../_lib/stripe.js';

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('session_id');
  if (!validSessionId(id)) return json({ error: 'Lien de commande invalide.' }, 400);
  try {
    const session = await stripe(env, 'GET', `checkout/sessions/${id}`, { expand: ['invoice'] });
    if (session.payment_status !== 'paid') return json({ error: 'Paiement non confirmé.', status: session.payment_status }, 402);
    const ageDays = (Date.now() / 1000 - session.created) / 86400;
    const invoice = session.invoice && typeof session.invoice === 'object' ? session.invoice : null;
    return json({
      ok: true,
      email: (session.customer_details && session.customer_details.email) || null,
      amount: session.amount_total,
      currency: session.currency,
      downloadUrl: ageDays <= DOWNLOAD_DAYS ? `/api/download?session_id=${encodeURIComponent(id)}` : null,
      expiresInDays: Math.max(0, Math.ceil(DOWNLOAD_DAYS - ageDays)),
      invoiceUrl: invoice ? invoice.hosted_invoice_url || null : null,
      invoicePdf: invoice ? invoice.invoice_pdf || null : null,
    });
  } catch (err) {
    console.error('[verify]', err.message);
    return json({ error: err.status === 404 ? 'Commande introuvable.' : 'Vérification impossible pour le moment.' }, err.status === 404 ? 404 : 502);
  }
}
