import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface FlyingItem {
  id: string;
  image: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  targetX: number;
  targetY: number;
}

interface CartContextType {
  cart: CartItem[];
  isCartOpen: boolean;
  checkoutStep: 'cart' | 'shipping' | 'success';
  setCheckoutStep: (step: 'cart' | 'shipping' | 'success') => void;
  cartItemsCount: number;
  cartSubtotal: number;
  addToCart: (product: Product, quantity?: number, sourceImageElement?: HTMLElement | null) => void;
  updateQuantity: (productId: number, delta: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  isCartBouncing: boolean;
  triggerCartBounce: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'ms_ambar_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'success'>('cart');
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [isCartBouncing, setIsCartBouncing] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Cargar estado inicial desde LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.warn('Error al leer carrito de localStorage:', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persistir en LocalStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.warn('Error al guardar carrito en localStorage:', e);
    }
  }, [cart, isHydrated]);

  const triggerCartBounce = useCallback(() => {
    setIsCartBouncing(true);
    setTimeout(() => {
      setIsCartBouncing(false);
    }, 800);
  }, []);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const toggleCart = useCallback(() => {
    setIsCartOpen((prev) => !prev);
  }, []);

  const addToCart = useCallback(
    (product: Product, quantityToAdd: number = 1, sourceImageElement?: HTMLElement | null) => {
      const qty = Math.max(1, quantityToAdd);

      // Disparar microinteracción Fly-to-Cart si hay elemento de origen
      if (sourceImageElement && typeof window !== 'undefined') {
        const sourceRect = sourceImageElement.getBoundingClientRect();
        // Buscar el icono del carrito en el navbar (desktop o mobile)
        const targetElement =
          document.getElementById('navbar-cart-icon') ||
          document.getElementById('mobile-navbar-cart-icon');

        let targetX = window.innerWidth - 80;
        let targetY = 30;

        if (targetElement) {
          const targetRect = targetElement.getBoundingClientRect();
          targetX = targetRect.left + targetRect.width / 2;
          targetY = targetRect.top + targetRect.height / 2;
        }

        const resolvedImage =
          (product.images && product.images.length > 0
            ? typeof product.images[0] === 'string'
              ? product.images[0]
              : product.images[0]?.image
            : product.image) || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80';

        const flyingId = `${product.id}-${Date.now()}`;
        const newFlyingItem: FlyingItem = {
          id: flyingId,
          image: resolvedImage,
          startX: sourceRect.left,
          startY: sourceRect.top,
          startWidth: sourceRect.width,
          startHeight: sourceRect.height,
          targetX,
          targetY,
        };

        setFlyingItems((prev) => [...prev, newFlyingItem]);
      } else {
        // Si no hay animación visual de vuelo, dispara rebote directo
        triggerCartBounce();
      }

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
        if (existingIndex > -1) {
          const updated = [...prevCart];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + qty,
          };
          return updated;
        }
        return [...prevCart, { product, quantity: qty }];
      });
    },
    [triggerCartBounce]
  );

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const handleAnimationComplete = useCallback(
    (id: string) => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== id));
      triggerCartBounce();
    },
    [triggerCartBounce]
  );

  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const cartSubtotal = cart.reduce((acc, item) => {
    const rawPrice = item.product.price;
    const numPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice as string) || 0;
    return acc + numPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isCartOpen,
        checkoutStep,
        setCheckoutStep,
        cartItemsCount,
        cartSubtotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        openCart,
        closeCart,
        toggleCart,
        isCartBouncing,
        triggerCartBounce,
      }}
    >
      {children}

      {/* Fly-to-Cart Animation Overlay Portal */}
      <AnimatePresence>
        {flyingItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{
              position: 'fixed',
              top: item.startY,
              left: item.startX,
              width: item.startWidth,
              height: item.startHeight,
              opacity: 1,
              scale: 1,
              borderRadius: '1.5rem',
              zIndex: 99999,
              pointerEvents: 'none',
            }}
            animate={{
              top: item.targetY - 24,
              left: item.targetX - 24,
              width: 48,
              height: 48,
              opacity: [1, 1, 0.8, 0],
              scale: [1, 0.9, 0.4, 0.15],
              rotate: [0, -10, 15, 0],
              borderRadius: '9999px',
            }}
            transition={{
              duration: 0.65,
              ease: [0.16, 1, 0.3, 1],
            }}
            onAnimationComplete={() => handleAnimationComplete(item.id)}
            className="overflow-hidden shadow-2xl border-2 border-amber-honey ring-4 ring-amber-honey/30 bg-black/90"
          >
            <img src={item.image} alt="Animación carrito" className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </AnimatePresence>
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
