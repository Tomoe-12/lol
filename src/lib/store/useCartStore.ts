import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string; // generated from product.id + variant.id + addon_ids
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    categoryId: string;
    price: number;
  };
  selectedVariant: {
    id: string;
    name: string;
    barcode?: string | null;
    costPrice?: number;
    price?: number;
    stockLevels?: { branchId: string; quantity: number }[];
  } | null;
  quantity: number;
  unitPrice: number; // base price
  discount: number; // item-level discount
  discountType: "percentage" | "fixed";
  note?: string;
}

export interface HeldCart {
  id: string;
  name: string;
  items: CartItem[];
  orderDiscount: number;
  orderDiscountType: "percentage" | "fixed";
  createdAt: number;
}

interface CartState {
  items: CartItem[];
  activeBranchId: string;
  activeBranchName: string;
  exchangeRate: number; // MMK per USD
  orderDiscount: number;
  orderDiscountType: "percentage" | "fixed";
  heldCarts: HeldCart[];
  
  // Actions
  setBranch: (id: string, name: string) => void;
  setExchangeRate: (rate: number) => void;
  addItem: (item: Omit<CartItem, "id" | "unitPrice">) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemDiscount: (itemId: string, discount: number, type: "percentage" | "fixed") => void;
  updateItemNote: (itemId: string, note: string) => void;
  setOrderDiscount: (discount: number, type: "percentage" | "fixed") => void;
  clearCart: () => void;
  
  // Hold & Resume
  holdCart: (name: string) => void;
  resumeCart: (heldCartId: string) => void;
  deleteHeldCart: (heldCartId: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      activeBranchId: "",
      activeBranchName: "",
      exchangeRate: 4500, // Default MMK per USD
      orderDiscount: 0,
      orderDiscountType: "fixed",
      heldCarts: [],

      setBranch: (id, name) => set({ activeBranchId: id, activeBranchName: name }),
      setExchangeRate: (rate) => set({ exchangeRate: rate }),

      addItem: (newItem) => {
        const variantId = newItem.selectedVariant?.id || "no-variant";
        const itemId = `${newItem.product.id}-${variantId}`;

        const unitPrice = newItem.product.price || 0;

        const existingItems = get().items;
        const existingItemIndex = existingItems.findIndex((item) => item.id === itemId);

        if (existingItemIndex > -1) {
          const updatedItems = [...existingItems];
          updatedItems[existingItemIndex].quantity += newItem.quantity;
          set({ items: updatedItems });
        } else {
          set({
            items: [
              ...existingItems,
              {
                ...newItem,
                id: itemId,
                unitPrice,
              },
            ],
          });
        }
      },

      removeItem: (itemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        })),

      updateQuantity: (itemId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? { ...item, quantity: Math.max(1, Number.isFinite(quantity) ? Math.floor(quantity) : 1) }
              : item
          ),
        })),

      updateItemDiscount: (itemId, discount, type) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, discount, discountType: type } : item
          ),
        })),

      updateItemNote: (itemId, note) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, note } : item
          ),
        })),

      setOrderDiscount: (discount, type) =>
        set({ orderDiscount: discount, orderDiscountType: type }),

      clearCart: () => set({ items: [], orderDiscount: 0, orderDiscountType: "fixed" }),

      holdCart: (name) => {
        const { items, orderDiscount, orderDiscountType, heldCarts } = get();
        if (items.length === 0) return;

        const newHeldCart: HeldCart = {
          id: Math.random().toString(36).substr(2, 9),
          name: name || `Order #${heldCarts.length + 1}`,
          items,
          orderDiscount,
          orderDiscountType,
          createdAt: Date.now(),
        };

        set({
          heldCarts: [...heldCarts, newHeldCart],
          items: [],
          orderDiscount: 0,
          orderDiscountType: "fixed",
        });
      },

      resumeCart: (heldCartId) => {
        const { heldCarts } = get();
        const cartToResume = heldCarts.find((c) => c.id === heldCartId);
        if (!cartToResume) return;

        set({
          items: cartToResume.items,
          orderDiscount: cartToResume.orderDiscount,
          orderDiscountType: cartToResume.orderDiscountType,
          heldCarts: heldCarts.filter((c) => c.id !== heldCartId),
        });
      },

      deleteHeldCart: (heldCartId) =>
        set((state) => ({
          heldCarts: state.heldCarts.filter((c) => c.id !== heldCartId),
        })),
    }),
    {
      name: "pos-cart-storage",
    }
  )
);
