// Public hairstyle catalogue. Names are neutral: any style fits any character.
// id → French label shown in UIs. Old ids stay accepted through HAIR_ALIASES.
const HAIR_CATALOG = {
  original: ['Original'],
  classique: ['Classique'],
  tres_court: ['Très court'],
  degrade: ['Dégradé'],
  pixie: ['Pixie'],
  mi_long: ['Mi-long'],
  lisse: ['Lisse'],
  ondule: ['Ondulé'],
  boucles: ['Boucles'],
  afro: ['Afro'],
  dreadlocks: ['Dreadlocks'],
  tresses: ['Tresses'],
  tresses_plaquees: ['Tresses plaquées'],
  chignon: ['Chignon'],
  queue_de_cheval: ['Queue de cheval'],
  chauve: ['Chauve'],
  barbe: ['Barbe']
};
const HAIR_ALIASES = {
  afro_femme: 'afro', chignon_femme: 'chignon', tresses_femme: 'tresses',
  bald: 'chauve', medium: 'mi_long', fade: 'degrade', cornrows: 'tresses_plaquees',
  ponytail: 'queue_de_cheval', straight: 'lisse', wavy: 'ondule', curly: 'boucles', beard: 'barbe'
};
function normalizeHairStyle(id) {
  const key = String(id || '').trim();
  if (HAIR_CATALOG[key]) return key;
  if (HAIR_ALIASES[key]) return HAIR_ALIASES[key];
  console.warn(`[UkoMascot] Unknown hairStyle "${key}". Available: ${Object.keys(HAIR_CATALOG).join(', ')}`);
  return 'dreadlocks';
}
