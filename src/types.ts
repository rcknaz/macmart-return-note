export interface ReturnNote {
  id: string;
  noteNumber: string;
  title: string;
  status: 'draft' | 'completed';
  creatorId: string;
  creatorEmail: string;
  createdAt: any; // Firestore Timestamp or date
  updatedAt: any; // Firestore Timestamp or date
}

export interface ReturnNoteItem {
  id: string;
  productName: string;
  barcode: string;
  quantity: number;
  expiryDate: string; // YYYY-MM-DD
  reason: string;
  createdAt: any;
}

export const COMMON_REASONS = [
  "Past Expiry Date",
  "Close to Expiry (Short Shelf Life)",
  "Damaged Product Packaging",
  "Product Recalled by Manufacturer",
  "Spoiled/Discolored/Bad Odor",
  "Incorrect Shipment/Overstock Expiry",
  "Customer Return - Expired"
];
