export type PurchaseHistoryEntry = {
  id: number;
  userId: number;
  customerId: number | null;
  customerWhatsapp: string | null;
  customerName: string | null;
  categoryId: number | null;
  categoryName: string;
  categoryPrice: number;
  categoryDescription: string | null;
  productId: number | null;
  productDetails: string;
  productFilePath: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  purchasedAt: string;
};
