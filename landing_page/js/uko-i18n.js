// Texts written by the page scripts (the HTML itself is translated at build time,
// see test_and_deploy/i18n_site.cjs). The language is the page's <html lang>.
(function () {
  const L = (document.documentElement.lang || 'fr').slice(0, 2);
  const T = {
    copy: { fr: 'copier', en: 'copy', es: 'copiar' },
    copied: { fr: 'copié ✓', en: 'copied ✓', es: 'copiado ✓' },
    soundOff: { fr: '🔇 son', en: '🔇 sound', es: '🔇 sonido' },
    soundOn: { fr: '🔊 son', en: '🔊 sound', es: '🔊 sonido' },
    payCanceled: { fr: 'Paiement annulé. Rien n’a été débité.', en: 'Payment cancelled. Nothing was charged.', es: 'Pago cancelado. No se ha cobrado nada.' },
    payConsent: { fr: 'Coche la case ci-dessus pour continuer.', en: 'Tick the box above to continue.', es: 'Marca la casilla de arriba para continuar.' },
    payConnecting: { fr: 'Connexion au paiement sécurisé…', en: 'Connecting to the secure payment…', es: 'Conectando con el pago seguro…' },
    payUnavailable: { fr: 'Le paiement est momentanément indisponible. Réessaie dans un instant.', en: 'Payment is unavailable right now. Try again in a moment.', es: 'El pago no está disponible ahora mismo. Inténtalo dentro de un momento.' },
    payOffline: { fr: 'Connexion impossible. Vérifie ta connexion et réessaie.', en: 'Could not connect. Check your connection and try again.', es: 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.' },
    duringRequest: { fr: 'pendant une requête', en: 'during a request', es: 'durante una petición' },
    filmError: { fr: 'erreur 404 ?!', en: 'error 404?!', es: '¿¡error 404!?' },
    filmDone: { fr: 'terminé ✓', en: 'done ✓', es: 'listo ✓' },
    filmLoading: { fr: 'chargement…', en: 'loading…', es: 'cargando…' },
    filmPause: { fr: 'Mettre en pause', en: 'Pause', es: 'Pausar' },
    filmPlay: { fr: 'Lire le film', en: 'Play the film', es: 'Reproducir la película' },
    filmGift: { fr: 'cadeau ?', en: 'a gift?', es: '¿regalo?' },
    filmTapWake: { fr: '👆 un tap, il se réveille', en: '👆 one tap, it wakes up', es: '👆 un toque y se despierta' },
    filmTapDizzy: { fr: '👆👆👆 tout étourdi', en: '👆👆👆 all dizzy', es: '👆👆👆 todo mareado' },
    filmTitle: { fr: 'trois mascottes pour ton app', en: 'three mascots for your app', es: 'tres mascotas para tu app' }
  };
  window.ukoLang = L;
  window.ukoT = (key, params) => {
    const e = T[key]; let s = e ? (e[L] || e.fr) : key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
    return s;
  };
})();
