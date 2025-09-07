export type StockItem = {
  id?: string;
  name: string;
  batchNumber: string;
  hsnCode: string;
  expiryDate: string; // ISO string YYYY-MM-DD
  gstPercent: number; // e.g., 12
  gstAmount: number; // calculated or provided
  totalAmount: number; // inclusive amount
  quantity: number; // current units available
  createdAt?: number;
};

export type DispenseRecord = {
  id?: string;
  stockItemId: string;
  stockNameSnapshot: string;
  batchNumberSnapshot: string;
  patientName: string;
  doctorName: string;
  quantity: number;
  dispensedAt: number; // epoch ms
};
