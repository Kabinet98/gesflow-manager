/** Catégories du coffre-fort (aligné avec le backend GesFlow) */
export const VAULT_CATEGORIES = [
  "Or",
  "Argent",
  "Platine",
  "Palladium",
  "Diamant",
  "Montre",
  "Bijoux",
  "Numismatique",
  "Billets et devises",
  "Titres et documents",
  "Œuvres d'art",
  "Électronique de valeur",
  "Autre",
  "Cash",
  "Document",
  "Collection",
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

/** Catégories avec quantité fixée à 1 */
export const VAULT_CATEGORIES_QUANTITY_ONE = ["Titres et documents", "Document"] as const;

/** Catégories sans date d'achat pertinente */
export const VAULT_CATEGORIES_NO_DATE = ["Billets et devises", "Titres et documents", "Cash", "Document"] as const;

/** Métaux pour lesquels le poids (grammes) est requis */
export const VAULT_CATEGORIES_METAL_WEIGHT_REQUIRED = ["Or", "Argent", "Platine", "Palladium"] as const;

/** Catégories pour lesquelles le numéro de série est pertinent (Montre, Électronique) */
export const VAULT_CATEGORIES_SERIAL_NUMBER = ["Montre", "Électronique de valeur"] as const;

/** Catégories pour lesquelles les notes sont affichées (toutes sauf métaux purs / cash) */
export const VAULT_CATEGORIES_NOTES = [
  "Diamant",
  "Montre",
  "Bijoux",
  "Numismatique",
  "Titres et documents",
  "Œuvres d'art",
  "Électronique de valeur",
  "Autre",
  "Document",
  "Collection",
] as const;

/** Types de montres (sélection pour mobile) */
export const VAULT_WATCH_TYPES = [
  "Submariner",
  "Daytona",
  "Datejust",
  "Royal Oak",
  "Nautilus",
  "Speedmaster",
  "Seamaster",
  "Autre",
] as const;

/** Marques de montres (sélection pour mobile) */
export const VAULT_WATCH_BRANDS = [
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Cartier",
  "Omega",
  "Vacheron Constantin",
  "IWC",
  "Jaeger-LeCoultre",
  "Tag Heuer",
  "Tudor",
  "Seiko",
  "Tissot",
  "Autre",
] as const;

/** Devises pour le coffre-fort (aligné avec GesFlow CurrencySelect) */
export const VAULT_CURRENCIES: { code: string; name: string }[] = [
  { code: "GNF", name: "Franc guinéen" },
  { code: "USD", name: "Dollar américain" },
  { code: "EUR", name: "Euro" },
  { code: "XOF", name: "Franc CFA (BCEAO)" },
  { code: "XAF", name: "Franc CFA (BEAC)" },
  { code: "GBP", name: "Livre sterling" },
  { code: "JPY", name: "Yen japonais" },
  { code: "CNY", name: "Yuan chinois" },
  { code: "CAD", name: "Dollar canadien" },
  { code: "AUD", name: "Dollar australien" },
  { code: "CHF", name: "Franc suisse" },
  { code: "NGN", name: "Naira nigérian" },
  { code: "ZAR", name: "Rand sud-africain" },
  { code: "EGP", name: "Livre égyptienne" },
  { code: "KES", name: "Shilling kényan" },
  { code: "GHS", name: "Cedi ghanéen" },
  { code: "MAD", name: "Dirham marocain" },
  { code: "TND", name: "Dinar tunisien" },
  { code: "DZD", name: "Dinar algérien" },
  { code: "XPF", name: "Franc CFP" },
  { code: "BDT", name: "Taka bangladais" },
  { code: "INR", name: "Roupie indienne" },
  { code: "PKR", name: "Roupie pakistanaise" },
  { code: "LKR", name: "Roupie srilankaise" },
  { code: "THB", name: "Baht thaïlandais" },
  { code: "VND", name: "Dong vietnamien" },
  { code: "IDR", name: "Roupie indonésienne" },
  { code: "PHP", name: "Peso philippin" },
  { code: "MYR", name: "Ringgit malaisien" },
  { code: "SGD", name: "Dollar de Singapour" },
  { code: "HKD", name: "Dollar de Hong Kong" },
  { code: "KRW", name: "Won sud-coréen" },
  { code: "TWD", name: "Dollar de Taïwan" },
  { code: "NZD", name: "Dollar néo-zélandais" },
  { code: "BRL", name: "Real brésilien" },
  { code: "ARS", name: "Peso argentin" },
  { code: "CLP", name: "Peso chilien" },
  { code: "COP", name: "Peso colombien" },
  { code: "MXN", name: "Peso mexicain" },
  { code: "PEN", name: "Sol péruvien" },
  { code: "RUB", name: "Rouble russe" },
  { code: "TRY", name: "Livre turque" },
  { code: "ILS", name: "Shekel israélien" },
  { code: "AED", name: "Dirham des Émirats arabes unis" },
  { code: "SAR", name: "Riyal saoudien" },
  { code: "QAR", name: "Riyal qatari" },
  { code: "KWD", name: "Dinar koweïtien" },
  { code: "BHD", name: "Dinar bahreïni" },
  { code: "OMR", name: "Rial omanais" },
  { code: "JOD", name: "Dinar jordanien" },
  { code: "LBP", name: "Livre libanaise" },
  { code: "NOK", name: "Couronne norvégienne" },
  { code: "SEK", name: "Couronne suédoise" },
  { code: "DKK", name: "Couronne danoise" },
  { code: "PLN", name: "Zloty polonais" },
  { code: "CZK", name: "Couronne tchèque" },
  { code: "HUF", name: "Forint hongrois" },
  { code: "RON", name: "Leu roumain" },
  { code: "BGN", name: "Lev bulgare" },
  { code: "UAH", name: "Hryvnia ukrainienne" },
  { code: "RWF", name: "Franc rwandais" },
  { code: "TZS", name: "Shilling tanzanien" },
  { code: "UGX", name: "Shilling ougandais" },
  { code: "ETB", name: "Birr éthiopien" },
  { code: "MUR", name: "Roupie mauricienne" },
  { code: "CDF", name: "Franc congolais" },
  { code: "AOA", name: "Kwanza angolais" },
  { code: "ZMW", name: "Kwacha zambien" },
  { code: "BWP", name: "Pula botswanais" },
];
