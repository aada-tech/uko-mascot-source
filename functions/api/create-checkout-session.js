// POST /api/create-checkout-session — Uko Mascot Pack, Stripe Checkout.
//
// - The amount is defined HERE (price_data), so what is charged always matches
//   the price shown on the site: 6,99 €, one-time payment.
// - The buyer must tick the consent box (CGV + licence + immediate access with
//   waiver of the withdrawal right, Code de la consommation L221-28 13°).
//   Consent time and terms version are stored in the session metadata as proof.
// - Redirect URLs are built from SITE_URL / the request origin only.
// - Stripe errors are logged, never sent to the browser.
import { stripe, json, sameOrigin, siteUrl } from '../_lib/stripe.js';

export const PRODUCT = {
  id: 'uko',
  name: 'Uko — Mascot Pack',
  description: 'Moteur Uko (Web Component + React), 9 états, 17 coiffures, fichier Rive avec machine à états. Licence commerciale perpétuelle.',
  amount: 699,          // centimes — prix affiché sur le site (6,99 €)
  currency: 'eur',
};
export const TERMS_VERSION = '2026-09-27';
const SUBMIT_TEXT = {
  fr: 'Accès immédiat après paiement : tu as demandé l’exécution immédiate et renoncé à ton droit de rétractation (CGV). Paiement unique, sans abonnement.',
  en: 'Immediate access after payment: you asked for immediate delivery and waived your right of withdrawal (terms of sale). One-time payment, no subscription.',
  es: 'Acceso inmediato tras el pago: pediste la entrega inmediata y renunciaste a tu derecho de desistimiento (condiciones de venta). Pago único, sin suscripción.',
};

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Origine non autorisée.' }, 403);
  let body = {};
  try { body = await request.json(); } catch (e) { /* empty body */ }
  if (body.consent !== true) return json({ error: 'Coche la case d’acceptation des CGV avant de payer.' }, 400);
  // The page's language (fr, en, es): Stripe Checkout and the way back follow it.
  const lang = ['fr', 'en', 'es'].includes(body.lang) ? body.lang : 'fr';

  const base = siteUrl(request, env);
  const consentAt = new Date().toISOString();
  try {
    const session = await stripe(env, 'POST', 'checkout/sessions', {
      mode: 'payment',
      locale: lang,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: PRODUCT.currency,
          unit_amount: PRODUCT.amount,
          tax_behavior: 'inclusive',
          product_data: { name: PRODUCT.name, description: PRODUCT.description },
        },
      }],
      metadata: { product: PRODUCT.id, terms_version: TERMS_VERSION, consent_withdrawal_waiver: 'yes', consent_at: consentAt },
      payment_intent_data: { metadata: { product: PRODUCT.id, terms_version: TERMS_VERSION } },
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${lang === 'fr' ? '' : '/' + lang}/?canceled=1#prix`,
      custom_text: { submit: { message: SUBMIT_TEXT[lang] } },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `${PRODUCT.name} — licence commerciale perpétuelle`,
          footer: `Contenu numérique fourni immédiatement avec l’accord exprès du client, qui a renoncé à son droit de rétractation (art. L221-28 13° C. conso.). CGV version ${TERMS_VERSION}.${env.VAT_MENTION ? ' ' + env.VAT_MENTION : ''}`,
          metadata: { product: PRODUCT.id, terms_version: TERMS_VERSION, consent_at: consentAt },
          rendering_options: { amount_tax_display: 'include_inclusive_tax' },
        },
      },
      automatic_tax: { enabled: env.STRIPE_AUTOMATIC_TAX === 'true' },
      allow_promotion_codes: true,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout]', err.message);
    return json({ error: 'Le paiement est momentanément indisponible. Réessaie dans un instant.' }, 502);
  }
}
