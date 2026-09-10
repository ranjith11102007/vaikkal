import type {
  BulkRequirement,
  Cart,
  Category,
  FarmerProfile,
  Forecast,
  Order,
  Payment,
  Product,
  Recommendation,
  Review,
  ServiceArea,
} from '@/types';

export interface MockUser {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  password: string;
  role: string;
  is_verified: boolean;
  avatar_url: string | null;
  created_at: string;
}

export type SeedProduct = Product & {
  featured?: boolean;
};

export type SeedOrder = Order & {
  producerId?: string;
};

export interface MockDB {
  version: number;
  users: MockUser[];
  profiles: Record<string, FarmerProfile>;
  categories: Category[];
  products: SeedProduct[];
  productListings: ProductListing[];
  carts: Record<string, Cart>;
  orders: SeedOrder[];
  forecasts: Forecast[];
  recommendations: Recommendation[];
  bulkRequirements: BulkRequirement[];
  serviceAreas: ServiceArea[];
  payments: Record<string, Payment>;
  reviews: Review[];
}

export interface ProductListing {
  id: string;
  productId: string;
  productName: string;
  pricePerUnit: number;
  wholesalePrice?: number;
  grade: string;
  availableQuantity: number;
  minOrderQuantity: number;
  locationDistrict?: string;
  producerType?: string;
  status: string;
  createdAt: string;
}