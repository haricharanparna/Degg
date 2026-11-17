// Product and market catalog. Every price is normalised to XOF per canonical unit.
export const PRODUCTS = [
  { id: 'rice', fr: 'Riz brisé', en: 'Broken rice', wo: 'Ceeb', unit: 'kg', syn: ['riz', 'rice', 'ceeb', 'cheb'] },
  { id: 'onion', fr: 'Oignon', en: 'Onion', wo: 'Soble', unit: 'kg', syn: ['oignon', 'oignons', 'onion', 'soble', 'soble'] },
  { id: 'oil', fr: 'Huile', en: 'Cooking oil', wo: 'Diwlin', unit: 'L', syn: ['huile', 'oil', 'diwlin', 'diw'] },
  { id: 'sugar', fr: 'Sucre', en: 'Sugar', wo: 'Suukar', unit: 'kg', syn: ['sucre', 'sugar', 'suukar'] },
  { id: 'potato', fr: 'Pomme de terre', en: 'Potato', wo: 'Pombiteer', unit: 'kg', syn: ['pomme de terre', 'pommes de terre', 'patate', 'potato', 'pombiteer'] },
  { id: 'tomato', fr: 'Tomate', en: 'Tomato', wo: 'Tamaate', unit: 'kg', syn: ['tomate', 'tomates', 'tomato', 'tamaate'] },
  { id: 'millet', fr: 'Mil', en: 'Millet', wo: 'Dugub', unit: 'kg', syn: ['mil', 'millet', 'dugub'] },
  { id: 'fish', fr: 'Poisson (yaboy)', en: 'Fish (sardinella)', wo: 'Yaboy', unit: 'kg', syn: ['poisson', 'yaboy', 'fish', 'jën', 'jen', 'sardinelle'] },
  { id: 'bread', fr: 'Pain', en: 'Bread', wo: 'Mburu', unit: 'piece', syn: ['pain', 'baguette', 'bread', 'mburu'] },
];

export const MARKETS = [
  { id: 'sandaga', name: 'Sandaga' },
  { id: 'tilene', name: 'Tilène' },
  { id: 'castors', name: 'Castors' },
  { id: 'hlm', name: 'HLM' },
  { id: 'thiaroye', name: 'Thiaroye' },
];

export const productById = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
export const marketById = Object.fromEntries(MARKETS.map(m => [m.id, m]));

// Sanity bounds per canonical unit (XOF). Reports outside these are rejected outright.
export const BOUNDS = { rice: [100, 3000], onion: [100, 3000], oil: [300, 5000], sugar: [200, 3000],
  potato: [100, 3000], tomato: [100, 5000], millet: [100, 3000], fish: [200, 10000], bread: [50, 1000] };
