import React, { useState, useMemo, type RefObject } from "react";
import {
  Search,
  Star,
  UtensilsCrossed,
  Plus,
  Pencil,
} from "lucide-react";
import type { Product, ProductCategory, SelectedModifier } from "../types/pos";
import { formatCurrency } from "../utils/format";
import { ModifierBar } from "./ModifierBar";
import { ProductDrawer } from "./ProductDrawer";

interface CatalogColumnProps {
  products: Product[];
  searchInputRef: RefObject<HTMLInputElement | null>;
  onAddToCart: (product: Product, modifiers?: SelectedModifier[]) => void;
  onToggleFavorite: (productId: string) => void;
  configuringProduct: Product | null;
  setConfiguringProduct: (p: Product | null) => void;
  onOpenNewProduct?: () => void;
  onEditProduct?: (product: Product) => void;
  isProductDrawerOpen?: boolean;
  drawerTargetProduct?: Product | null;
  onCloseProductDrawer?: () => void;
}

const CATEGORIES: (ProductCategory | "TODOS" | "FAVORITOS")[] = [
  "TODOS",
  "FAVORITOS",
  "Sandwiches",
  "Licuados",
  "Bebidas",
  "Combos",
  "Varios",
];

export const CatalogColumn: React.FC<CatalogColumnProps> = ({
  products,
  searchInputRef,
  onAddToCart,
  onToggleFavorite,
  configuringProduct,
  setConfiguringProduct,
  onOpenNewProduct,
  onEditProduct,
  isProductDrawerOpen = false,
  drawerTargetProduct = null,
  onCloseProductDrawer = () => {},
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    ProductCategory | "TODOS" | "FAVORITOS"
  >("TODOS");
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrado reactivo optimizado
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      // Filtro de categoría
      if (selectedCategory === "FAVORITOS" && !p.isFavorite) return false;
      if (
        selectedCategory !== "TODOS" &&
        selectedCategory !== "FAVORITOS" &&
        p.category !== selectedCategory
      ) {
        return false;
      }

      // Filtro de texto / código de barras
      if (!query) return true;

      const nameMatch = p.name.toLowerCase().includes(query);
      const shortNameMatch = p.shortName?.toLowerCase().includes(query);
      const barcodeMatch = p.barcode?.toLowerCase().includes(query);
      const idMatch = p.id.toLowerCase().includes(query);

      return nameMatch || shortNameMatch || barcodeMatch || idMatch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Manejo de Enter en el buscador (escaneo de código de barras o búsqueda rápida)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredProducts.length > 0) {
      e.preventDefault();
      // Si hay coincidencia exacta de código de barras o es el primer resultado
      const target =
        filteredProducts.find((p) => p.barcode === searchQuery.trim()) ||
        filteredProducts[0];

      if (target.modifiers && target.modifiers.length > 0) {
        setConfiguringProduct(target);
      } else {
        onAddToCart(target, []);
      }
      setSearchQuery("");
    }
  };

  const handleProductClick = (product: Product) => {
    onAddToCart(product, []);
  };

  return (
    <section className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 overflow-hidden relative">
      {/* ── Barra Superior: Buscador Híbrido ── */}
      <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar por nombre, código de barras (F2)..."
            className="w-full pl-9 pr-14 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
              F2
            </span>
          </div>
        </div>

        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded bg-slate-800 border border-slate-700"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* ── Categorías (Tabs / Pills) ── */}
      <div className="px-3 py-2 bg-slate-900/30 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
        {onOpenNewProduct && (
          <button
            type="button"
            onClick={onOpenNewProduct}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 shadow-sm shadow-emerald-950/60 transition-all cursor-pointer border border-emerald-500/50"
            title="Crear un nuevo producto en mostrador"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Nuevo Ítem</span>
          </button>
        )}

        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count =
            cat === "TODOS"
              ? products.length
              : cat === "FAVORITOS"
              ? products.filter((p) => p.isFavorite).length
              : products.filter((p) => p.category === cat).length;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950"
                  : "bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-850"
              }`}
            >
              {cat === "FAVORITOS" && <Star className="w-3.5 h-3.5 fill-current text-amber-300" />}
              <span>{cat === "TODOS" ? "Todos" : cat === "FAVORITOS" ? "Favoritos" : cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? "bg-emerald-950/30 text-slate-950" : "bg-slate-800 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Lista compacta de Productos ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <UtensilsCrossed className="w-8 h-8 opacity-40" />
            <p className="text-sm">No se encontraron productos en esta categoría o búsqueda.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 overflow-hidden">
            {filteredProducts.map((product) => {
              const hasMods = Boolean(product.modifiers?.length);
              const isBeingConfigured = configuringProduct?.id === product.id;

              return (
                <div
                  key={product.id}
                  className={`group flex h-12 items-center gap-2 border-l-[3px] px-2.5 select-none transition-colors ${
                    isBeingConfigured
                      ? "bg-emerald-950/40"
                      : "bg-slate-900/70"
                  }`}
                  style={{ borderLeftColor: product.colorTag || "#10B981" }}
                >
                  <button
                    type="button"
                    onClick={() => handleProductClick(product)}
                    aria-label={`Agregar ${product.name}, ${formatCurrency(product.basePrice)}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-500"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-white">
                          {product.name}
                        </span>
                        {hasMods && (
                          <span className="shrink-0 rounded bg-slate-800 px-1 py-0.5 text-[9px] text-emerald-400">
                            Extras
                          </span>
                        )}
                        {product.isCombo && (
                          <span className="shrink-0 rounded bg-purple-950 px-1 py-0.5 text-[9px] font-bold text-purple-300">
                            COMBO
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[10px] leading-3 text-slate-500">
                        {product.shortName && product.shortName !== product.name
                          ? product.shortName
                          : product.category}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-emerald-400">
                      {formatCurrency(product.basePrice)}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(product.id);
                      }}
                      className="rounded p-1 text-slate-500 hover:text-amber-400"
                      title={product.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                      aria-label={product.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                    >
                      <Star className={`h-3.5 w-3.5 ${product.isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
                    </button>
                    {onEditProduct && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditProduct(product);
                        }}
                        className="rounded p-1 text-slate-500 hover:text-emerald-400"
                        title="Editar producto"
                        aria-label={`Editar ${product.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Barra Contextual de Modificadores (No bloqueante) ── */}
      {configuringProduct && (
        <ModifierBar
          product={configuringProduct}
          onClose={() => setConfiguringProduct(null)}
          onAddToCart={onAddToCart}
        />
      )}

      {/* ── Drawer Lateral Express: Alta, Edición y Duplicación ── */}
      <ProductDrawer
        isOpen={isProductDrawerOpen}
        product={drawerTargetProduct}
        onClose={onCloseProductDrawer}
        onRequestEditProduct={onEditProduct}
      />
    </section>
  );
};
