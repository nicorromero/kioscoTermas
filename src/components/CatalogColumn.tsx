import React, { useState, useMemo, type RefObject } from "react";
import { Search, Star, Sparkles, UtensilsCrossed, Layers, Barcode, Plus } from "lucide-react";
import type { Product, ProductCategory, SelectedModifier } from "../types/pos";
import { formatCurrency } from "../utils/format";
import { ModifierBar } from "./ModifierBar";

interface CatalogColumnProps {
  products: Product[];
  searchInputRef: RefObject<HTMLInputElement | null>;
  onAddToCart: (product: Product, modifiers?: SelectedModifier[]) => void;
  onToggleFavorite: (productId: string) => void;
  configuringProduct: Product | null;
  setConfiguringProduct: (p: Product | null) => void;
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
    if (product.modifiers && product.modifiers.length > 0) {
      // Abrir barra contextual de modificadores
      setConfiguringProduct(product);
    } else {
      // Producto directo sin modificadores
      onAddToCart(product, []);
    }
  };

  return (
    <section className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 overflow-hidden">
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

      {/* ── Grilla de Productos ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <UtensilsCrossed className="w-8 h-8 opacity-40" />
            <p className="text-sm">No se encontraron productos en esta categoría o búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredProducts.map((product) => {
              const hasMods = product.modifiers && product.modifiers.length > 0;
              const isBeingConfigured = configuringProduct?.id === product.id;

              return (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`group relative flex flex-col justify-between p-2.5 rounded-xl border bg-slate-900/90 cursor-pointer select-none transition-all duration-100 hover:scale-[1.01] active:scale-[0.98] ${
                    isBeingConfigured
                      ? "ring-2 ring-emerald-500 border-emerald-500 bg-slate-850 shadow-lg shadow-emerald-950"
                      : "border-slate-800/90 hover:border-slate-700 hover:bg-slate-850/90 shadow-sm"
                  }`}
                >
                  {/* Etiqueta de color lateral / superior */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl opacity-80"
                    style={{ backgroundColor: product.colorTag || "#10B981" }}
                  />

                  {/* Cabecera del producto & Botón Favorito */}
                  <div className="flex items-start justify-between gap-1 pt-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      {product.category}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(product.id);
                      }}
                      className="p-1 -mr-1 -mt-1 text-slate-500 hover:text-amber-400 transition-colors"
                      title={product.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          product.isFavorite ? "text-amber-400 fill-amber-400" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Nombre y Nombre Corto */}
                  <div className="my-1.5">
                    <p className="font-semibold text-xs text-white leading-snug line-clamp-2">
                      {product.name}
                    </p>
                    {product.shortName && product.shortName !== product.name && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {product.shortName}
                      </p>
                    )}
                  </div>

                  {/* Badges de Combo o Modificadores */}
                  <div className="flex items-center gap-1 my-1">
                    {product.isCombo && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        COMBO
                      </span>
                    )}
                    {hasMods && (
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                        +Extras
                      </span>
                    )}
                  </div>

                  {/* Precio y Botón Rápido */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 mt-auto">
                    <span className="font-mono font-bold text-sm text-emerald-400">
                      {formatCurrency(product.basePrice)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProductClick(product);
                      }}
                      className="w-6 h-6 rounded-md bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 flex items-center justify-center transition-colors"
                      title={hasMods ? "Personalizar" : "Agregar directo"}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
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
    </section>
  );
};
