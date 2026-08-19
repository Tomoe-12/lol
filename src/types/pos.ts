export interface Variant {
  id: string;
  name: string;
  barcode?: string | null;
  costPrice: number;
  price?: number;
  lowStockThreshold?: number;
  stockLevels?: {
    branchId: string;
    quantity: number;
  }[];
}

export interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  categoryId: string;
  price: number;
  variants: Variant[];
}

export interface Category {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  receiptHeader: string | null;
}

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
  branchName: string;
}
