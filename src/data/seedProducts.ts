// ─── Seed de productos – Kiosco Termas ───────────────────────────────────────
// ~120 productos realistas para un kiosco dentro de un complejo termal.
// businessId y branchId fijos; cambiar al conectar con backend real.

import type { Product, ModifierOption } from "../types/pos";

const BIZ = "grupo-termal";
const BRANCH = "termas-kiosco";

/* ══════════════════════════════════════════════════════════════════════════════
   Modificadores reutilizables
   ══════════════════════════════════════════════════════════════════════════════ */

const modSandwichExtras: ModifierOption[] = [
  { id: "mod-jyq",       name: "+ Jamón y Queso",       priceDelta: 2_000, group: "extras" },
  { id: "mod-tyl",       name: "+ Tomate y Lechuga",    priceDelta: 3_000, group: "extras" },
  { id: "mod-completa",  name: "Completa",              priceDelta: 5_000, group: "extras" },
  { id: "mod-huevo",     name: "+ Huevo Frito",          priceDelta: 1_500, group: "extras" },
  { id: "mod-bacon",     name: "+ Bacon",                priceDelta: 2_500, group: "extras" },
  { id: "mod-cheddar",   name: "+ Cheddar",              priceDelta: 1_500, group: "extras" },
  { id: "mod-tostado",   name: "Tostado",                priceDelta: 0,     group: "cocción" },
];

const modLicuadoBase: ModifierOption[] = [
  { id: "mod-agua",  name: "Con Agua",  priceDelta: 0,   group: "base-licuado", exclusive: true },
  { id: "mod-leche", name: "Con Leche", priceDelta: 500, group: "base-licuado", exclusive: true },
];

const modLicuadoExtras: ModifierOption[] = [
  ...modLicuadoBase,
  { id: "mod-granola",    name: "+ Granola",         priceDelta: 800,  group: "extras-licuado" },
  { id: "mod-miel",       name: "+ Miel",            priceDelta: 500,  group: "extras-licuado" },
  { id: "mod-proteina",   name: "+ Proteína",        priceDelta: 1_500, group: "extras-licuado" },
];

const modHamburguesaExtras: ModifierOption[] = [
  { id: "mod-jyq",       name: "+ Jamón y Queso",    priceDelta: 2_000, group: "extras" },
  { id: "mod-tyl",       name: "+ Tomate y Lechuga", priceDelta: 3_000, group: "extras" },
  { id: "mod-completa",  name: "Completa",           priceDelta: 5_000, group: "extras" },
  { id: "mod-huevo",     name: "+ Huevo Frito",       priceDelta: 1_500, group: "extras" },
  { id: "mod-bacon",     name: "+ Bacon",             priceDelta: 2_500, group: "extras" },
  { id: "mod-cheddar",   name: "+ Cheddar",           priceDelta: 1_500, group: "extras" },
  { id: "mod-pepinos",   name: "+ Pepinos",           priceDelta: 500,   group: "extras" },
  { id: "mod-cebolla-cr",name: "+ Cebolla Crispy",    priceDelta: 1_000, group: "extras" },
];

const modEmpanada: ModifierOption[] = [
  { id: "mod-emp-horno",  name: "Al Horno",  priceDelta: 0, group: "cocción-emp", exclusive: true },
  { id: "mod-emp-frita",  name: "Frita",     priceDelta: 0, group: "cocción-emp", exclusive: true },
];

const modCafeSize: ModifierOption[] = [
  { id: "mod-cafe-chico",  name: "Chico",  priceDelta: 0,     group: "tamaño-cafe", exclusive: true },
  { id: "mod-cafe-grande", name: "Grande", priceDelta: 1_000, group: "tamaño-cafe", exclusive: true },
];

/* ══════════════════════════════════════════════════════════════════════════════
   Helper
   ══════════════════════════════════════════════════════════════════════════════ */

let _counter = 0;
function p(
  overrides: Omit<Product, "id" | "businessId" | "branchId"> & { id?: string },
): Product {
  _counter++;
  return {
    id: overrides.id ?? `prod-${String(_counter).padStart(3, "0")}`,
    businessId: BIZ,
    branchId: BRANCH,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   🥪  SANDWICHES  (~20)
   ══════════════════════════════════════════════════════════════════════════════ */

const sandwiches: Product[] = [
  // ── Milanesas ──
  p({ id: "sand-milacarne",   name: "Milanesa de Carne",           shortName: "Mila Carne",   category: "Sandwiches", basePrice: 10_000, modifiers: modSandwichExtras, isFavorite: true,  colorTag: "#F59E0B" }),
  p({ id: "sand-milapollo",   name: "Milanesa de Pollo",           shortName: "Mila Pollo",   category: "Sandwiches", basePrice: 10_000, modifiers: modSandwichExtras, isFavorite: true,  colorTag: "#F59E0B" }),
  p({ id: "sand-milanap",     name: "Milanesa Napolitana",         shortName: "Napo",         category: "Sandwiches", basePrice: 13_000, modifiers: modSandwichExtras, colorTag: "#EF4444" }),

  // ── Hamburguesas ──
  p({ id: "sand-hambsimple",  name: "Hamburguesa Simple",          shortName: "Hamb Simple",  category: "Sandwiches", basePrice: 10_000, modifiers: modHamburguesaExtras, isFavorite: true, colorTag: "#8B5CF6" }),
  p({ id: "sand-hambdoble",   name: "Hamburguesa Doble",           shortName: "Hamb Doble",   category: "Sandwiches", basePrice: 14_000, modifiers: modHamburguesaExtras, colorTag: "#8B5CF6" }),
  p({ id: "sand-hambqueso",   name: "Hamburguesa con Queso",       shortName: "Hamb Queso",   category: "Sandwiches", basePrice: 12_000, modifiers: modHamburguesaExtras, colorTag: "#8B5CF6" }),
  p({ id: "sand-hambcrispy",  name: "Hamburguesa Crispy",          shortName: "Crispy",       category: "Sandwiches", basePrice: 13_000, modifiers: modHamburguesaExtras, colorTag: "#8B5CF6" }),

  // ── Lomitos ──
  p({ id: "sand-lomito",      name: "Lomito",                      shortName: "Lomito",       category: "Sandwiches", basePrice: 14_000, modifiers: modSandwichExtras, colorTag: "#10B981" }),
  p({ id: "sand-lomcompleto", name: "Lomito Completo",             shortName: "Lom Compl",    category: "Sandwiches", basePrice: 18_000, colorTag: "#10B981" }),

  // ── Tostados ──
  p({ id: "sand-tostjyq",     name: "Tostado de Jamón y Queso",    shortName: "Tost JyQ",     category: "Sandwiches", basePrice: 6_000,  isFavorite: true, colorTag: "#FBBF24" }),
  p({ id: "sand-tostjqt",     name: "Tostado de J, Q y Tomate",    shortName: "Tost JQT",     category: "Sandwiches", basePrice: 7_000,  colorTag: "#FBBF24" }),
  p({ id: "sand-tosttriple",  name: "Tostado Triple",              shortName: "Tost Triple",  category: "Sandwiches", basePrice: 9_000,  colorTag: "#FBBF24" }),

  // ── Otros sándwiches ──
  p({ id: "sand-pancho",      name: "Pancho",                      shortName: "Pancho",       category: "Sandwiches", basePrice: 4_000,  modifiers: [
    { id: "mod-panchoqueso", name: "+ Queso", priceDelta: 1_000, group: "extras-pancho" },
    { id: "mod-panchoched",  name: "+ Cheddar", priceDelta: 1_500, group: "extras-pancho" },
    { id: "mod-panchocompl", name: "Completo (Mostaza, Ketchup, Mayonesa)", priceDelta: 0, group: "extras-pancho" },
  ], isFavorite: true, colorTag: "#EC4899" }),
  p({ id: "sand-panchodoble", name: "Pancho Doble",                shortName: "Pancho x2",    category: "Sandwiches", basePrice: 6_500,  colorTag: "#EC4899" }),
  p({ id: "sand-bondiola",    name: "Sándwich de Bondiola",        shortName: "Bondiola",     category: "Sandwiches", basePrice: 14_000, modifiers: modSandwichExtras, colorTag: "#D97706" }),
  p({ id: "sand-pollo",       name: "Sándwich de Pollo Grillé",    shortName: "Pollo Grillé", category: "Sandwiches", basePrice: 11_000, modifiers: modSandwichExtras, colorTag: "#059669" }),
  p({ id: "sand-veggie",      name: "Sándwich Veggie",             shortName: "Veggie",       category: "Sandwiches", basePrice: 9_000,  colorTag: "#22C55E" }),
  p({ id: "sand-atun",        name: "Sándwich de Atún",            shortName: "Atún",         category: "Sandwiches", basePrice: 7_500,  colorTag: "#0EA5E9" }),
  p({ id: "sand-carlitos",    name: "Carlitos (JyQ chico)",        shortName: "Carlitos",     category: "Sandwiches", basePrice: 3_500,  colorTag: "#FBBF24" }),
  p({ id: "sand-wrap",        name: "Wrap de Pollo",               shortName: "Wrap",         category: "Sandwiches", basePrice: 10_000, modifiers: [
    { id: "mod-wrap-cheddar", name: "+ Cheddar", priceDelta: 1_500, group: "extras-wrap" },
    { id: "mod-wrap-bacon",   name: "+ Bacon",   priceDelta: 2_500, group: "extras-wrap" },
  ], colorTag: "#059669" }),
];

/* ══════════════════════════════════════════════════════════════════════════════
   🥤  LICUADOS  (~15)
   ══════════════════════════════════════════════════════════════════════════════ */

const licuados: Product[] = [
  p({ id: "lic-banana",       name: "Licuado de Banana",               shortName: "Lic Banana",    category: "Licuados", basePrice: 5_500, modifiers: modLicuadoExtras, isFavorite: true, colorTag: "#FBBF24" }),
  p({ id: "lic-frutilla",     name: "Licuado de Frutilla",             shortName: "Lic Frutilla",  category: "Licuados", basePrice: 6_000, modifiers: modLicuadoExtras, colorTag: "#F43F5E" }),
  p({ id: "lic-durazno",      name: "Licuado de Durazno",              shortName: "Lic Durazno",   category: "Licuados", basePrice: 6_000, modifiers: modLicuadoExtras, colorTag: "#FB923C" }),
  p({ id: "lic-anana",        name: "Licuado de Ananá",                shortName: "Lic Ananá",     category: "Licuados", basePrice: 6_500, modifiers: modLicuadoExtras, colorTag: "#FACC15" }),
  p({ id: "lic-mango",        name: "Licuado de Mango",                shortName: "Lic Mango",     category: "Licuados", basePrice: 7_000, modifiers: modLicuadoExtras, colorTag: "#FB923C" }),
  p({ id: "lic-banana-frut",  name: "Licuado de Banana y Frutilla",    shortName: "Banana+Frut",   category: "Licuados", basePrice: 6_500, modifiers: modLicuadoExtras, isFavorite: true, colorTag: "#F472B6" }),
  p({ id: "lic-durazno-ban",  name: "Licuado de Durazno y Banana",     shortName: "Duraz+Bana",    category: "Licuados", basePrice: 6_500, modifiers: modLicuadoExtras, colorTag: "#FBBF24" }),
  p({ id: "lic-tropical",     name: "Licuado Frutas Tropicales",       shortName: "Tropical",      category: "Licuados", basePrice: 7_500, modifiers: modLicuadoExtras, colorTag: "#F97316" }),
  p({ id: "lic-banana-choc",  name: "Licuado de Banana y Chocolate",   shortName: "Bana+Choco",    category: "Licuados", basePrice: 7_000, modifiers: modLicuadoBase, colorTag: "#92400E" }),
  p({ id: "lic-frutos-rojos", name: "Smoothie de Frutos Rojos",        shortName: "Frut Rojos",    category: "Licuados", basePrice: 7_500, modifiers: modLicuadoBase, colorTag: "#BE123C" }),
  p({ id: "lic-verde",        name: "Smoothie Verde",                   shortName: "Verde",         category: "Licuados", basePrice: 7_000, modifiers: modLicuadoBase, colorTag: "#16A34A" }),
  p({ id: "lic-melon",        name: "Licuado de Melón",                shortName: "Lic Melón",     category: "Licuados", basePrice: 6_000, modifiers: modLicuadoExtras, colorTag: "#A3E635" }),
  p({ id: "lic-sandia",       name: "Licuado de Sandía",               shortName: "Lic Sandía",    category: "Licuados", basePrice: 6_000, modifiers: modLicuadoExtras, colorTag: "#F87171" }),
  p({ id: "lic-naranja-ban",  name: "Licuado de Naranja y Banana",     shortName: "Nara+Bana",     category: "Licuados", basePrice: 6_500, modifiers: modLicuadoExtras, colorTag: "#FB923C" }),
  p({ id: "lic-pera",         name: "Licuado de Pera",                 shortName: "Lic Pera",      category: "Licuados", basePrice: 6_000, modifiers: modLicuadoExtras, colorTag: "#BEF264" }),
];

/* ══════════════════════════════════════════════════════════════════════════════
   🥤  BEBIDAS  (~35)
   ══════════════════════════════════════════════════════════════════════════════ */

const bebidas: Product[] = [
  // ── Gaseosas ──
  p({ id: "beb-coca500",      name: "Coca-Cola 500 ml",             shortName: "Coca 500",      category: "Bebidas", basePrice: 3_500,  isFavorite: true, colorTag: "#DC2626" }),
  p({ id: "beb-cocazero500",  name: "Coca-Cola Zero 500 ml",        shortName: "Coca Zero",     category: "Bebidas", basePrice: 3_500,  colorTag: "#1F2937" }),
  p({ id: "beb-coca1500",     name: "Coca-Cola 1.5 L",              shortName: "Coca 1.5",      category: "Bebidas", basePrice: 6_000,  colorTag: "#DC2626" }),
  p({ id: "beb-sprite500",    name: "Sprite 500 ml",                shortName: "Sprite 500",    category: "Bebidas", basePrice: 3_500,  colorTag: "#22C55E" }),
  p({ id: "beb-spritez500",   name: "Sprite Zero 500 ml",           shortName: "Sprite Zero",   category: "Bebidas", basePrice: 3_500,  colorTag: "#16A34A" }),
  p({ id: "beb-fanta500",     name: "Fanta Naranja 500 ml",         shortName: "Fanta",         category: "Bebidas", basePrice: 3_500,  colorTag: "#F97316" }),
  p({ id: "beb-schwep500",    name: "Schweppes Pomelo 500 ml",      shortName: "Schweppes",     category: "Bebidas", basePrice: 3_500,  colorTag: "#FDE047" }),

  // ── Aguas ──
  p({ id: "beb-agua500",      name: "Agua Mineral 500 ml",          shortName: "Agua 500",      category: "Bebidas", basePrice: 2_000,  isFavorite: true, colorTag: "#38BDF8" }),
  p({ id: "beb-agua1500",     name: "Agua Mineral 1.5 L",           shortName: "Agua 1.5",      category: "Bebidas", basePrice: 3_500,  colorTag: "#38BDF8" }),
  p({ id: "beb-aguagas500",   name: "Agua Mineral con Gas 500 ml",  shortName: "Agua Gas",      category: "Bebidas", basePrice: 2_500,  colorTag: "#7DD3FC" }),
  p({ id: "beb-levpom",       name: "Levité Pomelo 500 ml",         shortName: "Levité Pom",    category: "Bebidas", basePrice: 3_000,  colorTag: "#FDE68A" }),
  p({ id: "beb-levnar",       name: "Levité Naranja 500 ml",        shortName: "Levité Nar",    category: "Bebidas", basePrice: 3_000,  colorTag: "#FDBA74" }),
  p({ id: "beb-levmanz",      name: "Levité Manzana 500 ml",        shortName: "Levité Manz",   category: "Bebidas", basePrice: 3_000,  colorTag: "#86EFAC" }),

  // ── Cervezas ──
  p({ id: "beb-quilmes",      name: "Cerveza Quilmes 473 ml",       shortName: "Quilmes",       category: "Bebidas", basePrice: 4_500,  isFavorite: true, colorTag: "#2563EB" }),
  p({ id: "beb-brahma",       name: "Cerveza Brahma 473 ml",        shortName: "Brahma",        category: "Bebidas", basePrice: 4_000,  colorTag: "#DC2626" }),
  p({ id: "beb-stella",       name: "Cerveza Stella Artois 473 ml", shortName: "Stella",        category: "Bebidas", basePrice: 5_000,  colorTag: "#FBBF24" }),
  p({ id: "beb-patagonia",    name: "Cerveza Patagonia Amber 473 ml", shortName: "Patagonia",   category: "Bebidas", basePrice: 5_500,  colorTag: "#D97706" }),
  p({ id: "beb-corona",       name: "Cerveza Corona 710 ml",        shortName: "Corona",        category: "Bebidas", basePrice: 6_500,  colorTag: "#FDE047" }),
  p({ id: "beb-heineken",     name: "Cerveza Heineken 473 ml",      shortName: "Heineken",      category: "Bebidas", basePrice: 5_500,  colorTag: "#16A34A" }),
  p({ id: "beb-ipa-art",      name: "Cerveza IPA Artesanal 500 ml", shortName: "IPA Artes",     category: "Bebidas", basePrice: 7_000,  colorTag: "#EA580C" }),

  // ── Jugos ──
  p({ id: "beb-cepnar",       name: "Jugo Cepita Naranja 1 L",      shortName: "Cepita Nar",    category: "Bebidas", basePrice: 4_000, colorTag: "#FB923C" }),
  p({ id: "beb-cepmanz",      name: "Jugo Cepita Manzana 1 L",      shortName: "Cepita Manz",   category: "Bebidas", basePrice: 4_000, colorTag: "#4ADE80" }),
  p({ id: "beb-baggio",       name: "Jugo Baggio Multifruta 1 L",    shortName: "Baggio",        category: "Bebidas", basePrice: 3_500, colorTag: "#F472B6" }),

  // ── Energizantes / Deportivas ──
  p({ id: "beb-speed",        name: "Speed 250 ml",                  shortName: "Speed",         category: "Bebidas", basePrice: 4_000,  colorTag: "#FBBF24" }),
  p({ id: "beb-redbull",      name: "Red Bull 250 ml",               shortName: "Red Bull",      category: "Bebidas", basePrice: 6_000,  colorTag: "#3B82F6" }),
  p({ id: "beb-gatorade",     name: "Gatorade 500 ml",               shortName: "Gatorade",      category: "Bebidas", basePrice: 4_500,  colorTag: "#22D3EE" }),
  p({ id: "beb-powerade",     name: "Powerade 500 ml",               shortName: "Powerade",      category: "Bebidas", basePrice: 4_500,  colorTag: "#2563EB" }),

  // ── Infusiones / Cafetería ──
  p({ id: "beb-matecocido",   name: "Mate Cocido",                   shortName: "Mate Coc",      category: "Bebidas", basePrice: 2_500, colorTag: "#65A30D" }),
  p({ id: "beb-cafeleche",    name: "Café con Leche",                shortName: "Café c/L",      category: "Bebidas", basePrice: 4_000, modifiers: modCafeSize, colorTag: "#92400E" }),
  p({ id: "beb-cortado",      name: "Café Cortado",                  shortName: "Cortado",       category: "Bebidas", basePrice: 3_500, modifiers: modCafeSize, colorTag: "#78350F" }),
  p({ id: "beb-americano",    name: "Café Americano",                shortName: "Americano",     category: "Bebidas", basePrice: 3_000, modifiers: modCafeSize, colorTag: "#451A03" }),
  p({ id: "beb-capuchino",    name: "Capuchino",                     shortName: "Capuchino",     category: "Bebidas", basePrice: 4_500, modifiers: modCafeSize, colorTag: "#A16207" }),
  p({ id: "beb-te",           name: "Té",                             shortName: "Té",            category: "Bebidas", basePrice: 2_500, colorTag: "#15803D" }),
  p({ id: "beb-chococal",     name: "Chocolate Caliente",            shortName: "Choco Cal",     category: "Bebidas", basePrice: 4_500, colorTag: "#78350F" }),

  // ── Tragos ──
  p({ id: "beb-fernet",       name: "Fernet con Coca (vaso)",        shortName: "Fernet",        category: "Bebidas", basePrice: 7_000, colorTag: "#1E293B" }),
  p({ id: "beb-aperol",       name: "Aperol Spritz",                 shortName: "Aperol",        category: "Bebidas", basePrice: 8_500, colorTag: "#EA580C" }),
];

/* ══════════════════════════════════════════════════════════════════════════════
   🍟  COMBOS  (~12)
   ══════════════════════════════════════════════════════════════════════════════ */

const combos: Product[] = [
  p({
    id: "combo-milajyq", name: "Combo Milanesa JyQ", shortName: "C Mila JyQ",
    category: "Combos", basePrice: 16_000, isCombo: true, isFavorite: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-milacarne", qty: 1, label: "Milanesa + JyQ" },
      { productId: "var-papachico",  qty: 1, label: "Papas cono chico" },
      { productId: "beb-coca500",    qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-hambsimple", name: "Combo Hamburguesa Simple", shortName: "C Hamb",
    category: "Combos", basePrice: 15_000, isCombo: true, isFavorite: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-hambsimple", qty: 1, label: "Hamburguesa Simple" },
      { productId: "var-papachico",   qty: 1, label: "Papas cono chico" },
      { productId: "beb-coca500",     qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-hambdoble", name: "Combo Hamburguesa Doble", shortName: "C Hamb Dob",
    category: "Combos", basePrice: 19_000, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-hambdoble", qty: 1, label: "Hamburguesa Doble" },
      { productId: "var-papachico",  qty: 1, label: "Papas cono chico" },
      { productId: "beb-coca500",    qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-lomito", name: "Combo Lomito", shortName: "C Lomito",
    category: "Combos", basePrice: 20_000, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-lomito",   qty: 1, label: "Lomito" },
      { productId: "var-papachico", qty: 1, label: "Papas cono chico" },
      { productId: "beb-coca500",   qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-pancho", name: "Combo Pancho", shortName: "C Pancho",
    category: "Combos", basePrice: 8_000, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-pancho",   qty: 1, label: "Pancho" },
      { productId: "var-papachico", qty: 1, label: "Papas cono chico" },
      { productId: "beb-coca500",   qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-tostado", name: "Combo Tostado + Gaseosa", shortName: "C Tostado",
    category: "Combos", basePrice: 8_500, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-tostjyq", qty: 1, label: "Tostado JyQ" },
      { productId: "beb-coca500",  qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-milacompleta", name: "Combo Milanesa Completa", shortName: "C Mila Comp",
    category: "Combos", basePrice: 20_000, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-milacarne", qty: 1, label: "Milanesa Completa" },
      { productId: "var-papagrande", qty: 1, label: "Papas cono grande" },
      { productId: "beb-coca500",    qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-familiar", name: "Combo Familiar", shortName: "C Familiar",
    category: "Combos", basePrice: 28_000, isCombo: true, colorTag: "#A855F7",
    comboIncludes: [
      { productId: "sand-pancho",    qty: 4, label: "Pancho x4" },
      { productId: "var-papagrande", qty: 2, label: "Papas grande x2" },
      { productId: "beb-coca1500",   qty: 1, label: "Coca-Cola 1.5 L" },
    ],
  }),
  p({
    id: "combo-kids", name: "Combo Kids", shortName: "C Kids",
    category: "Combos", basePrice: 9_000, isCombo: true, colorTag: "#EC4899",
    comboIncludes: [
      { productId: "sand-pancho",   qty: 1, label: "Pancho" },
      { productId: "var-papachico", qty: 1, label: "Papas chicas" },
      { productId: "beb-cepnar",    qty: 1, label: "Jugo Cepita" },
    ],
  }),
  p({
    id: "combo-bondiola", name: "Combo Bondiola + Cerveza", shortName: "C Bondiola",
    category: "Combos", basePrice: 22_000, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-bondiola", qty: 1, label: "Bondiola" },
      { productId: "var-papagrande", qty: 1, label: "Papas grande" },
      { productId: "beb-quilmes",   qty: 1, label: "Cerveza Quilmes" },
    ],
  }),
  p({
    id: "combo-crispy", name: "Combo Crispy", shortName: "C Crispy",
    category: "Combos", basePrice: 18_000, isCombo: true, colorTag: "#7C3AED",
    comboIncludes: [
      { productId: "sand-hambcrispy", qty: 1, label: "Hamburguesa Crispy" },
      { productId: "var-papachico",   qty: 1, label: "Papas cono chico" },
      { productId: "beb-coca500",     qty: 1, label: "Gaseosa 500 ml" },
    ],
  }),
  p({
    id: "combo-merienda", name: "Combo Merienda", shortName: "C Merienda",
    category: "Combos", basePrice: 7_000, isCombo: true, colorTag: "#D946EF",
    comboIncludes: [
      { productId: "beb-cafeleche",   qty: 1, label: "Café con Leche" },
      { productId: "var-medialuna",   qty: 3, label: "Medialuna x3" },
    ],
  }),
];

/* ══════════════════════════════════════════════════════════════════════════════
   🛍️  VARIOS  (~38)
   ══════════════════════════════════════════════════════════════════════════════ */

const varios: Product[] = [
  // ── Papas / Acompañamientos ──
  p({ id: "var-papachico",    name: "Papas Fritas Cono Chico",       shortName: "Papas Ch",      category: "Varios", basePrice: 5_000,  isFavorite: true, colorTag: "#EAB308" }),
  p({ id: "var-papagrande",   name: "Papas Fritas Cono Grande",      shortName: "Papas Gr",      category: "Varios", basePrice: 7_500,  colorTag: "#EAB308" }),
  p({ id: "var-papached",     name: "Papas Fritas con Cheddar",      shortName: "Papas Ched",    category: "Varios", basePrice: 9_000,  colorTag: "#F59E0B" }),
  p({ id: "var-nuggets6",     name: "Nuggets x6",                    shortName: "Nugg x6",       category: "Varios", basePrice: 6_500,  colorTag: "#F59E0B" }),
  p({ id: "var-nuggets12",    name: "Nuggets x12",                   shortName: "Nugg x12",      category: "Varios", basePrice: 11_000, colorTag: "#F59E0B" }),
  p({ id: "var-mozza",        name: "Bastones de Mozzarella x4",     shortName: "Mozza x4",      category: "Varios", basePrice: 7_000,  colorTag: "#FBBF24" }),
  p({ id: "var-aroscebolla",  name: "Aros de Cebolla",               shortName: "Aros Ceb",      category: "Varios", basePrice: 6_000,  colorTag: "#D97706" }),
  p({ id: "var-choclo",       name: "Choclo con Manteca",            shortName: "Choclo",        category: "Varios", basePrice: 4_500,  colorTag: "#FACC15" }),

  // ── Empanadas ──
  p({ id: "var-empcarne",     name: "Empanada de Carne",             shortName: "Emp Carne",     category: "Varios", basePrice: 3_000, modifiers: modEmpanada, colorTag: "#F97316" }),
  p({ id: "var-empjyq",       name: "Empanada de Jamón y Queso",     shortName: "Emp JyQ",       category: "Varios", basePrice: 3_000, modifiers: modEmpanada, colorTag: "#F97316" }),
  p({ id: "var-emppollo",     name: "Empanada de Pollo",             shortName: "Emp Pollo",     category: "Varios", basePrice: 3_000, modifiers: modEmpanada, colorTag: "#F97316" }),
  p({ id: "var-emphumita",    name: "Empanada de Humita",            shortName: "Emp Humita",    category: "Varios", basePrice: 3_000, modifiers: modEmpanada, colorTag: "#F97316" }),
  p({ id: "var-docenaemps",   name: "Docena de Empanadas Surtidas",  shortName: "Emp x12",       category: "Varios", basePrice: 30_000, colorTag: "#EA580C" }),

  // ── Golosinas / Alfajores ──
  p({ id: "var-alfhavanna",   name: "Alfajor Havanna",               shortName: "Alf Havanna",   category: "Varios", basePrice: 3_500, colorTag: "#854D0E" }),
  p({ id: "var-alfcachafaz",  name: "Alfajor Cachafaz",              shortName: "Alf Cachafaz",  category: "Varios", basePrice: 3_000, colorTag: "#78350F" }),
  p({ id: "var-alfjorgito",   name: "Alfajor Jorgito",               shortName: "Alf Jorgito",   category: "Varios", basePrice: 2_000, colorTag: "#92400E" }),
  p({ id: "var-alfaguila",    name: "Alfajor Águila",                shortName: "Alf Águila",    category: "Varios", basePrice: 2_000, colorTag: "#78350F" }),
  p({ id: "var-alfterrabusi", name: "Alfajor Terrabusi",             shortName: "Alf Terrb",     category: "Varios", basePrice: 1_500, colorTag: "#A16207" }),
  p({ id: "var-oreo",         name: "Galletitas Oreo",               shortName: "Oreo",          category: "Varios", basePrice: 2_500, colorTag: "#1E3A8A" }),
  p({ id: "var-toddy",        name: "Galletitas Toddy",              shortName: "Toddy",         category: "Varios", basePrice: 2_500, colorTag: "#78350F" }),
  p({ id: "var-barracereal",  name: "Barra de Cereal",               shortName: "Barra Cer",     category: "Varios", basePrice: 2_000, colorTag: "#65A30D" }),
  p({ id: "var-gomitas",      name: "Gomitas 100 g",                 shortName: "Gomitas",       category: "Varios", basePrice: 2_000, colorTag: "#F472B6" }),
  p({ id: "var-chupetin",     name: "Chupetín",                      shortName: "Chupetín",      category: "Varios", basePrice: 500,   colorTag: "#F43F5E" }),
  p({ id: "var-pochochico",   name: "Pochoclos Chicos",              shortName: "Pocho Ch",      category: "Varios", basePrice: 3_000, colorTag: "#FBBF24" }),
  p({ id: "var-pochogrande",  name: "Pochoclos Grandes",             shortName: "Pocho Gr",      category: "Varios", basePrice: 5_000, colorTag: "#FBBF24" }),
  p({ id: "var-garrapinada",  name: "Garrapiñada",                   shortName: "Garrap",        category: "Varios", basePrice: 4_000, colorTag: "#92400E" }),
  p({ id: "var-manichoc",     name: "Maní con Chocolate",            shortName: "Maní Choc",     category: "Varios", basePrice: 3_500, colorTag: "#78350F" }),

  // ── Helados ──
  p({ id: "var-helabombon",   name: "Helado Palito Bombón",          shortName: "Bombón",        category: "Varios", basePrice: 3_500, colorTag: "#6B21A8" }),
  p({ id: "var-helacono",     name: "Helado Cono",                   shortName: "Cono Helado",   category: "Varios", basePrice: 4_000, colorTag: "#C084FC" }),
  p({ id: "var-helafrutal",   name: "Helado Palito Frutal",          shortName: "Palito Frut",   category: "Varios", basePrice: 2_500, colorTag: "#FB7185" }),
  p({ id: "var-helapote",     name: "Helado Pote 250 ml",            shortName: "Pote 250",      category: "Varios", basePrice: 6_000, colorTag: "#A855F7" }),

  // ── Panadería / Repostería ──
  p({ id: "var-medialuna",    name: "Medialuna",                     shortName: "Medialuna",     category: "Varios", basePrice: 1_200, colorTag: "#FBBF24" }),
  p({ id: "var-facturasx3",   name: "Facturas x3",                   shortName: "Fact x3",       category: "Varios", basePrice: 3_500, colorTag: "#F59E0B" }),
  p({ id: "var-tortaddl",     name: "Torta de Dulce de Leche (porción)", shortName: "Torta DDL",  category: "Varios", basePrice: 5_500, colorTag: "#92400E" }),
  p({ id: "var-budinlimon",   name: "Budín de Limón (porción)",      shortName: "Budín Lim",     category: "Varios", basePrice: 4_000, colorTag: "#FDE047" }),

  // ── Artículos de pileta / playa ──
  p({ id: "var-protfps30",    name: "Protector Solar FPS 30",        shortName: "Protec 30",     category: "Varios", basePrice: 12_000, colorTag: "#0EA5E9" }),
  p({ id: "var-protfps50",    name: "Protector Solar FPS 50",        shortName: "Protec 50",     category: "Varios", basePrice: 16_000, colorTag: "#0284C7" }),
  p({ id: "var-ojotas",       name: "Ojotas (par)",                  shortName: "Ojotas",        category: "Varios", basePrice: 15_000, colorTag: "#6366F1" }),
  p({ id: "var-antiparras",   name: "Antiparras de Natación",        shortName: "Antiparras",    category: "Varios", basePrice: 10_000, colorTag: "#0EA5E9" }),
  p({ id: "var-toalla",       name: "Toalla Playera",                shortName: "Toalla",        category: "Varios", basePrice: 20_000, colorTag: "#818CF8" }),
];

/* ══════════════════════════════════════════════════════════════════════════════
   Exportación
   ══════════════════════════════════════════════════════════════════════════════ */

export const seedProducts: Product[] = [
  ...sandwiches,
  ...licuados,
  ...bebidas,
  ...combos,
  ...varios,
];

/** Mapa rápido por id */
export const productsById: Record<string, Product> = Object.fromEntries(
  seedProducts.map((p) => [p.id, p]),
);

/** Categorías disponibles (derivado del seed) */
export const categories: Product["category"][] = [
  "Sandwiches",
  "Licuados",
  "Bebidas",
  "Combos",
  "Varios",
];

export default seedProducts;
