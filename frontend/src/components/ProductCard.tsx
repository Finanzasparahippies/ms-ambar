import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Plus,
  Minus,
  ChevronDown,
  Info,
  Layers,
  Sparkles,
  Check,
  Pencil,
  Trash2
} from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  index?: number;
  isAdmin?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  index = 0,
  isAdmin = false,
  onEdit,
  onDelete
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [showSpecs, setShowSpecs] = useState<boolean>(false);
  const [isAdded, setIsAdded] = useState<boolean>(false);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const maxStock = typeof product.stock === 'number' && product.stock > 0 ? product.stock : 99;
    if (quantity < maxStock) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 1200);
  };

  const categoryLabel =
    product.category_name ||
    (typeof product.category === 'object' ? product.category?.name : undefined) ||
    'Colección Oficial';

  const specs = product.specifications;
  const hasSpecs =
    Boolean(specs) &&
    Boolean(
      specs?.material ||
      specs?.dimensions ||
      specs?.weight ||
      specs?.care_instructions ||
      specs?.origin ||
      (specs?.details && Object.keys(specs.details).length > 0) ||
      product.detailed_description
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="group relative flex flex-col bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-amber-honey/40 rounded-[2rem] p-4 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-amber-honey/10"
    >
      {/* Visual Media Container */}
      <div className="aspect-[4/5] w-full rounded-[1.6rem] overflow-hidden relative mb-4 bg-nature-night/60 border border-white/5">
        <img
          src={product.image || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80'}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-90 group-hover:opacity-100"
          loading="lazy"
        />

        {/* Category & Badge Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.18em] bg-black/60 backdrop-blur-md border border-white/10 text-white/90">
            {categoryLabel}
          </span>
          {typeof product.stock === 'number' && product.stock <= 5 && product.stock > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-honey">
              ¡Últimas {product.stock}!
            </span>
          )}
        </div>

        {/* Admin Quick Action Controls */}
        {isAdmin && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(product);
                }}
                className="w-8 h-8 rounded-full bg-black/70 hover:bg-amber-400 text-amber-400 hover:text-black border border-amber-400/40 flex items-center justify-center transition-all shadow-md backdrop-blur-md"
                title="Editar Producto"
                aria-label="Editar Producto"
              >
                <Pencil size={13} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(product);
                }}
                className="w-8 h-8 rounded-full bg-black/70 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 flex items-center justify-center transition-all shadow-md backdrop-blur-md"
                title="Eliminar Producto"
                aria-label="Eliminar Producto"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Information Header (Always Visible) */}
      <div className="flex-1 flex flex-col justify-between px-1">
        <div>
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-white transition-colors duration-300 group-hover:text-amber-honey leading-snug line-clamp-2">
              {product.name}
            </h3>
            <span className="shrink-0 font-black text-sm md:text-base text-amber-honey text-glow">
              ${product.price} MXN
            </span>
          </div>

          {product.description && (
            <p className="text-xs text-white/60 line-clamp-2 mb-3 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Technical Specifications Accordion Button */}
        {hasSpecs && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowSpecs((prev) => !prev)}
              className="w-full py-1.5 px-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-amber-honey/20 text-white/70 hover:text-white flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-all"
              aria-expanded={showSpecs}
            >
              <span className="flex items-center gap-1.5">
                <Info size={12} className="text-amber-honey" />
                Especificaciones Técnicas
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-300 text-white/50 ${showSpecs ? 'rotate-180 text-amber-honey' : ''}`}
              />
            </button>

            {/* Specifications Collapsible Panel */}
            <AnimatePresence>
              {showSpecs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-xl space-y-2 text-[11px] text-white/80">
                    {product.detailed_description && (
                      <p className="text-[10px] text-white/70 italic pb-1.5 border-b border-white/5 leading-relaxed">
                        {product.detailed_description}
                      </p>
                    )}

                    {specs?.material && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-white/40 uppercase tracking-widest font-semibold flex items-center gap-1">
                          <Layers size={10} className="text-amber-honey" /> Material
                        </span>
                        <span className="font-medium text-white/90">{specs.material}</span>
                      </div>
                    )}

                    {specs?.dimensions && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-white/40 uppercase tracking-widest font-semibold">Dimensiones</span>
                        <span className="font-medium text-white/90">{specs.dimensions}</span>
                      </div>
                    )}

                    {specs?.weight && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-white/40 uppercase tracking-widest font-semibold">Peso</span>
                        <span className="font-medium text-white/90">{specs.weight}</span>
                      </div>
                    )}

                    {specs?.origin && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-white/40 uppercase tracking-widest font-semibold">Origen</span>
                        <span className="font-medium text-white/90">{specs.origin}</span>
                      </div>
                    )}

                    {specs?.care_instructions && (
                      <div className="pt-1 border-t border-white/5">
                        <span className="block text-[9px] text-white/40 uppercase tracking-widest font-semibold mb-0.5">
                          Cuidados
                        </span>
                        <span className="text-[10px] text-white/80 leading-tight block">
                          {specs.care_instructions}
                        </span>
                      </div>
                    )}

                    {specs?.details &&
                      Object.entries(specs.details).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center text-[10px]">
                          <span className="text-white/40 uppercase tracking-widest font-semibold">{key}</span>
                          <span className="font-medium text-white/90">{val}</span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Action Bar: Interactive Quantity Controls & Add to Cart */}
        <div className="pt-2 flex items-center gap-2 border-t border-white/5">
          {/* Quantity Stepper */}
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={quantity <= 1}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all"
              aria-label="Disminuir cantidad"
            >
              <Minus size={12} />
            </button>
            <span className="w-8 text-center text-xs font-mono font-bold text-white selection:bg-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center text-white transition-all"
              aria-label="Aumentar cantidad"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleAddToCart}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-md ${
              isAdded
                ? 'bg-green-500 text-nature-night shadow-green-500/20'
                : 'bg-amber-honey hover:bg-amber-500 text-nature-night shadow-amber-honey/20'
            }`}
          >
            {isAdded ? (
              <>
                <Check size={14} className="stroke-[3]" />
                <span>¡Agregado!</span>
              </>
            ) : (
              <>
                <ShoppingBag size={14} />
                <span>Agregar ({quantity})</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
