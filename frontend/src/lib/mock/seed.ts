import type {
  Address,
  BulkRequirement,
  Category,
  FarmerProfile,
  Forecast,
  Order,
  OrderItem,
  OrderTimelineEvent,
  Payment,
  Product,
  Recommendation,
  Review,
  ServiceArea,
} from '@/types';
import { MockDB, MockUser, ProductListing, SeedOrder, SeedProduct } from './types';

const DAY = 24 * 60 * 60 * 1000;

function iso(daysFromNow: number, hours = 10): string {
  return new Date(Date.now() + daysFromNow * DAY + hours * 3600 * 1000).toISOString();
}

function ordinalNum(n: number): string {
  return String(n).padStart(4, '0');
}

export const DEMO_PASSWORD = 'Vaikkal@Demo123';

export const DEMO_ACCOUNTS: Array<{
  label: string;
  email: string;
  phone: string;
  password: string;
  role: string;
}> = [
  { label: 'Consumer', email: 'consumer1@vaikkal.in', phone: '9860000001', password: DEMO_PASSWORD, role: 'consumer' },
  { label: 'Farmer', email: 'farmer1@vaikkal.in', phone: '9820000001', password: DEMO_PASSWORD, role: 'farmer' },
  { label: 'FPO Admin', email: 'fpo1@vaikkal.in', phone: '9830000001', password: DEMO_PASSWORD, role: 'fpo_admin' },
  { label: 'Bulk Buyer', email: 'buyer-hotel@vaikkal.in', phone: '9840000001', password: DEMO_PASSWORD, role: 'bulk_buyer' },
  { label: 'Delivery Partner', email: 'delivery1@vaikkal.in', phone: '9850000001', password: DEMO_PASSWORD, role: 'delivery_partner' },
  { label: 'Admin', email: 'admin@vaikkal.in', phone: '9810000000', password: DEMO_PASSWORD, role: 'admin' },
];

function user(
  id: string,
  full_name: string,
  phone: string,
  email: string,
  role: string
): MockUser {
  return {
    id,
    full_name,
    phone,
    email,
    password: DEMO_PASSWORD,
    role,
    is_verified: true,
    avatar_url: null,
    created_at: iso(-60),
  };
}

const CATEGORIES: Array<{
  id: string;
  name: Category['name'];
  displayNameEn: string;
  displayNameTa: string;
  icon: string;
  description: string;
  order: number;
}> = [
  { id: 'cat-vegetables', name: 'vegetables', displayNameEn: 'Vegetables', displayNameTa: 'காய்கறிகள்', icon: 'carrot', description: 'Farm-fresh vegetables harvested daily', order: 1 },
  { id: 'cat-fruits', name: 'fruits', displayNameEn: 'Fruits', displayNameTa: 'பழங்கள்', icon: 'apple', description: 'Seasonal fruits from Tamil Nadu orchards', order: 2 },
  { id: 'cat-grains', name: 'grains', displayNameEn: 'Grains & Millets', displayNameTa: 'தானியங்கள் & சிறுதானியங்கள்', icon: 'wheat', description: 'Rice and millets grown without chemicals', order: 3 },
  { id: 'cat-pulses', name: 'pulses', displayNameEn: 'Pulses & Lentils', displayNameTa: 'பருப்பு வகைகள்', icon: 'bean', description: 'Protein-rich traditional dals', order: 4 },
  { id: 'cat-spices', name: 'spices', displayNameEn: 'Spices', displayNameTa: 'மசாலா பொருட்கள்', icon: 'flame', description: 'Single-origin spices, freshly ground', order: 5 },
  { id: 'cat-oilseeds', name: 'oilseeds', displayNameEn: 'Oilseeds', displayNameTa: 'எண்ணெய் வித்துக்கள்', icon: 'sun', description: 'Cold-pressed oil seeds', order: 6 },
  { id: 'cat-dairy', name: 'dairy', displayNameEn: 'Dairy & Eggs', displayNameTa: 'பால் & முட்டை', icon: 'egg', description: 'Cold-chain handled dairy products', order: 7 },
  { id: 'cat-organic', name: 'organic', displayNameEn: 'Organic Products', displayNameTa: 'இயற்கை விவசாயப் பொருட்கள்', icon: 'leaf', description: 'Certified organic produce', order: 8 },
  { id: 'cat-processed', name: 'processed', displayNameEn: 'Processed Foods', displayNameTa: 'பதப்படுத்தப்பட்ட உணவுகள்', icon: 'package', description: 'Traditional processed delicacies', order: 9 },
  { id: 'cat-seeds', name: 'seeds', displayNameEn: 'Seeds & Farm Inputs', displayNameTa: 'விதைகள் & விவசாய உள்ளீடுகள்', icon: 'seed', description: 'Quality seeds for the next crop', order: 10 },
  { id: 'cat-bulk', name: 'bulk', displayNameEn: 'Bulk Procurement', displayNameTa: 'மொத்த கொள்முதல்', icon: 'truck', description: 'Wholesale quantities for institutions', order: 11 },
  { id: 'cat-seasonal', name: 'seasonal', displayNameEn: 'Seasonal Products', displayNameTa: 'பருவகால பொருட்கள்', icon: 'calendar', description: 'Limited-season fresh picks', order: 12 },
];

type ProductSeed = {
  key: string;
  name: string;
  nameTa: string;
  categoryId: string;
  category: Category['name'];
  description: string;
  unit: string;
  price: number;
  qty: number;
  farmerId: string;
  producerId: string;
  producerName: string;
  entityType: 'farmer' | 'fpo';
  district: string;
  village?: string;
  grade: 'Premium' | 'A' | 'B' | 'Organic';
  organic?: boolean;
  featured?: boolean;
  minOrder?: number;
  avgRating?: number;
  totalRatings?: number;
  packagingType?: string;
  shelfLifeDays?: number;
};

function buildProducts(users: MockUser[]): SeedProduct[] {
  const far = users.find((u) => u.role === 'farmer')!;
  const far2 = users.filter((u) => u.role === 'farmer')[1]!;
  const fpo = users.find((u) => u.role === 'fpo_admin')!;

  const rows: ProductSeed[] = [
    { key: 'tomato', name: 'Tomato', nameTa: 'தக்காளி', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Fresh ripe tomatoes, harvest grade A, deep red with firm skin.', unit: 'kg', price: 32, qty: 250, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', village: 'Thondamuthur', grade: 'A', organic: true, featured: true, avgRating: 4.6, totalRatings: 128 },
    { key: 'tomato-mk', name: 'Tomato (Trichy)', nameTa: 'தக்காளி (திருச்சி)', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Grown near Trichy, ideal for sambar and curries.', unit: 'kg', price: 30, qty: 180, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', village: 'Manikandam', grade: 'A', avgRating: 4.4, totalRatings: 92 },
    { key: 'brinjal', name: 'Brinjal', nameTa: 'கத்தரிக்காய்', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Purple round brinjal from an organic farm, low seed content.', unit: 'kg', price: 45, qty: 120, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', village: 'Perur', grade: 'A', organic: true, featured: true, avgRating: 4.7, totalRatings: 76 },
    { key: 'brinjal-mk', name: 'Brinjal (Trichy)', nameTa: 'கத்தரிக்காய் (திருச்சி)', categoryId: 'cat-vegetables', category: 'vegetables', description: 'White-green variegated brinjal, tender and tasty.', unit: 'kg', price: 40, qty: 90, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', village: 'Manikandam', grade: 'A', avgRating: 4.2, totalRatings: 41 },
    { key: 'ladyfinger', name: 'Lady Finger', nameTa: 'வெண்டைக்காய்', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Tender okra, picked early morning, perfect for poriyal.', unit: 'kg', price: 38, qty: 100, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', grade: 'A', organic: true, avgRating: 4.5, totalRatings: 63 },
    { key: 'drumstick', name: 'Drumstick', nameTa: 'முருங்கைக்காய்', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Green drumstick, high nutrition, great for sambar.', unit: 'bundle', price: 25, qty: 60, minOrder: 6, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', grade: 'A', avgRating: 4.3, totalRatings: 55 },
    { key: 'countryveg', name: 'Country Vegetables', nameTa: 'நாட்டு காய்கறிகள்', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Traditional mix of native vegetables grown without chemicals.', unit: 'kg', price: 50, qty: 150, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', grade: 'A', organic: true, featured: true, avgRating: 4.8, totalRatings: 84 },
    { key: 'onion', name: 'Onion', nameTa: 'வெங்காயம்', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Salem red onion, long storage life, strong flavour.', unit: 'kg', price: 42, qty: 600, minOrder: 5, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Erode', grade: 'A', avgRating: 4.5, totalRatings: 210 },
    { key: 'greenchilli', name: 'Green Chilli', nameTa: 'பச்சை மிளகாய்', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Hot green chillies from morning harvest.', unit: 'kg', price: 28, qty: 60, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', grade: 'A', avgRating: 4.1, totalRatings: 39 },
    { key: 'coriander', name: 'Coriander Leaves', nameTa: 'கொத்தமல்லி', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Fresh coriander, daily harvest, aromatic leaves.', unit: 'bundle', price: 20, qty: 100, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', grade: 'A', avgRating: 4.2, totalRatings: 47 },
    { key: 'sweetpotato', name: 'Sweet Potato', nameTa: 'சர்க்கரைவள்ளிக்கிழங்கு', categoryId: 'cat-vegetables', category: 'vegetables', description: 'Red sweet potato from Trichy, naturally sweet.', unit: 'kg', price: 30, qty: 300, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', grade: 'A', avgRating: 4.6, totalRatings: 71 },
    { key: 'banana', name: 'Banana (Poovan)', nameTa: 'பூவன் வாழைப்பழம்', categoryId: 'cat-fruits', category: 'fruits', description: 'Poovan variety banana grown in Trichy belt.', unit: 'dozen', price: 55, qty: 200, farmerId: far2.id, producerId: far2.id, producerName: far2.full_name, entityType: 'farmer', district: 'Tiruchirappalli', grade: 'A', featured: true, avgRating: 4.7, totalRatings: 158 },
    { key: 'organicrice', name: 'Organic Rice', nameTa: 'இயற்கை அரிசி', categoryId: 'cat-grains', category: 'grains', description: 'Single-polish ponni rice, organic certified, freshly milled.', unit: 'kg', price: 85, qty: 2000, minOrder: 5, farmerId: far.id, producerId: fpo.id, producerName: fpo.full_name, entityType: 'fpo', district: 'Coimbatore', grade: 'Premium', organic: true, featured: true, avgRating: 4.9, totalRatings: 342, packagingType: '5 kg jute bag', shelfLifeDays: 180 },
    { key: 'varagu', name: 'Varagu Millet', nameTa: 'வரகு', categoryId: 'cat-grains', category: 'grains', description: 'Kodo millet, chemical-free, high fibre.', unit: 'kg', price: 95, qty: 500, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', grade: 'A', organic: true, avgRating: 4.5, totalRatings: 96, packagingType: '1 kg pouch', shelfLifeDays: 240 },
    { key: 'turmeric', name: 'Turmeric Powder', nameTa: 'மஞ்சள் தூள்', categoryId: 'cat-spices', category: 'spices', description: 'Pure Erode turmeric, no additives, high curcumin.', unit: 'kg', price: 165, qty: 200, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Erode', grade: 'Organic', organic: true, featured: true, avgRating: 4.8, totalRatings: 189, packagingType: '250 g jar', shelfLifeDays: 365 },
    { key: 'sirudhaniyam', name: 'Siru Dhaniya', nameTa: 'சீரகம்', categoryId: 'cat-spices', category: 'spices', description: 'Premium cumin with a strong aroma, single origin.', unit: 'kg', price: 320, qty: 80, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', grade: 'Premium', organic: true, avgRating: 4.6, totalRatings: 54, packagingType: '100 g jar', shelfLifeDays: 365 },
    { key: 'eggs', name: 'Country Eggs', nameTa: 'நாட்டு முட்டை', categoryId: 'cat-dairy', category: 'dairy', description: 'Free-range native country eggs, deep orange yolk.', unit: 'dozen', price: 84, qty: 500, minOrder: 1, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', grade: 'A', avgRating: 4.7, totalRatings: 264, packagingType: '12-egg tray', shelfLifeDays: 14 },
    { key: 'milk', name: 'Fresh Cow Milk', nameTa: 'பசும்பால்', categoryId: 'cat-dairy', category: 'dairy', description: 'Morning milk, cold-chain handled from farm to door.', unit: 'litre', price: 45, qty: 400, farmerId: far.id, producerId: far.id, producerName: far.full_name, entityType: 'farmer', district: 'Coimbatore', grade: 'A', avgRating: 4.6, totalRatings: 301, packagingType: '500 ml pouch', shelfLifeDays: 2 },
  ];

  const now = iso(0);
  const yesterday = iso(-1);
  const dayBefore = iso(-2);

  return rows.map((r) => {
    const base: Product = {
      id: `prod-${r.key}`,
      categoryId: r.categoryId,
      category: r.category,
      name: r.name,
      nameTa: r.nameTa,
      description: r.description,
      images: [],
      unit: r.unit,
      basePricePerUnit: r.price * 1.1,
      currentPricePerUnit: r.price,
      minOrderQuantity: r.minOrder ?? 1,
      availableQuantity: r.qty,
      farmerId: r.farmerId,
      producer: { id: r.producerId, name: r.producerName, entityType: r.entityType },
      sourceLocation: { district: r.district, village: r.village, state: 'Tamil Nadu' },
      grade: r.grade,
      packagingType: r.packagingType ?? 'Standard pack',
      harvestDate: dayBefore,
      shelfLifeDays: r.shelfLifeDays ?? 5,
      deliveryEstimateMins: 60,
      isOrganic: Boolean(r.organic),
      isOrganicCertified: Boolean(r.organic),
      certifications: r.organic ? ['IND-ORG-3241'] : [],
      stockStatus: r.qty < 100 ? 'low_stock' : 'in_stock',
      status: 'approved',
      avgRating: r.avgRating ?? 4.5,
      totalRatings: r.totalRatings ?? 20,
      tags: [r.category],
      createdAt: now,
      updatedAt: now,
    };
    return r.featured ? { ...base, featured: true } : base;
  });
}

function profiles(users: MockUser[]): Record<string, FarmerProfile> {
  const far = users.find((u) => u.role === 'farmer')!;
  const far2 = users.filter((u) => u.role === 'farmer')[1]!;
  const fpo = users.find((u) => u.role === 'fpo_admin')!;

  const base: Record<string, FarmerProfile> = {
    [far.id]: {
      id: 'fp-murugan',
      userId: far.id,
      farmName: 'Murugan Organic Farm',
      farmSizeAcres: 4.5,
      cropsGrown: ['Tomato', 'Lady Finger', 'Brinjal', 'Drumstick'],
      district: 'Coimbatore',
      village: 'Thondamuthur',
      state: 'Tamil Nadu',
      languagesSpoken: ['Tamil', 'English'],
      kycDocuments: [{ docType: 'Aadhaar', uploadedAt: iso(-90), status: 'verified' }],
      bankAccount: {
        accountNumberMasked: 'XXXXXX9012',
        ifsc: 'SBIN0001234',
        bankName: 'State Bank of India',
        accountHolderName: 'Murugan K',
      },
      bio: 'Organic farmer growing traditional varieties for 12 years.',
      certifications: ['NPOP Organic', 'India Organic'],
      yearsOfExperience: 12,
      averageRating: 4.8,
      totalRatings: 156,
      settlementsEnabled: true,
      preferredLanguages: ['ta', 'en'],
    },
    [far2.id]: {
      id: 'fp-meenakshi',
      userId: far2.id,
      farmName: 'Meenakshi Farm',
      farmSizeAcres: 3.0,
      cropsGrown: ['Brinjal', 'Tomato', 'Greens', 'Banana'],
      district: 'Tiruchirappalli',
      village: 'Manikandam',
      state: 'Tamil Nadu',
      languagesSpoken: ['Tamil'],
      kycDocuments: [{ docType: 'Aadhaar', uploadedAt: iso(-85), status: 'verified' }],
      bankAccount: {
        accountNumberMasked: 'XXXXXX1098',
        ifsc: 'HDFC0005678',
        bankName: 'HDFC Bank',
        accountHolderName: 'Meenakshi R',
      },
      bio: 'Multi-crop farmer near Trichy with focus on native greens.',
      certifications: [],
      yearsOfExperience: 8,
      averageRating: 4.5,
      totalRatings: 98,
      settlementsEnabled: true,
      preferredLanguages: ['ta'],
    },
    [fpo.id]: {
      id: 'fp-kongunadu',
      userId: fpo.id,
      farmName: 'Kongunadu Farmers Producer Company',
      farmSizeAcres: 120,
      cropsGrown: ['Rice', 'Tomato', 'Millets', 'Turmeric'],
      district: 'Coimbatore',
      village: 'Sathy Road',
      state: 'Tamil Nadu',
      languagesSpoken: ['Tamil', 'English'],
      kycDocuments: [{ docType: 'FPO Registration', uploadedAt: iso(-300), status: 'verified' }],
      bankAccount: {
        accountNumberMasked: 'XXXXXX7788',
        ifsc: 'CBIN0008899',
        bankName: 'Canara Bank',
        accountHolderName: 'Kongunadu FPO',
      },
      bio: 'Producer company aggregating 200+ member farmers.',
      certifications: ['FPO Certified'],
      yearsOfExperience: 7,
      averageRating: 4.7,
      totalRatings: 212,
      settlementsEnabled: true,
      preferredLanguages: ['ta', 'en'],
    },
  };
  return base;
}

function buildAddress(district: string, city: string, pincode: string, line1: string): Address {
  return {
    id: `addr-${district.toLowerCase().replace(/\s/g, '-')}`,
    label: 'Home',
    addressLine1: line1,
    city,
    district,
    state: 'Tamil Nadu',
    pincode,
    latitude: 10.99,
    longitude: 76.97,
    isDefault: true,
  };
}

function orderItem(product: SeedProduct, quantity: number): OrderItem {
  return {
    id: `oit-${product.id}-${Date.now().toString(36)}`,
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    pricePerUnit: product.currentPricePerUnit,
    totalPrice: Math.round(product.currentPricePerUnit * quantity * 100) / 100,
    farmerShareAmount: Math.round(product.currentPricePerUnit * quantity * 0.7 * 100) / 100,
  };
}

function timeline(status: Order['orderStatus'], createdAt: string): OrderTimelineEvent[] {
  const base: OrderTimelineEvent[] = [
    { id: `tl-1-${createdAt}`, status: 'placed', timestamp: createdAt, title: 'Order placed', description: 'Order received and confirmed by the platform.' },
  ];
  if (status === 'cancelled') {
    return [...base, { id: `tl-c-${createdAt}`, status: 'cancelled', timestamp: iso(0, 2), title: 'Order cancelled', description: 'Cancelled as requested. Refund initiated.' }];
  }
  if (status === 'delivered' || status === 'in_transit' || status === 'out_for_delivery' || status === 'processing') {
    base.push({ id: `tl-2-${createdAt}`, status: 'processing', timestamp: iso(0, 1), title: 'Processing at hub', description: 'Produce packed at Kongunadu collection hub.' });
  }
  if (status === 'delivered') {
    base.push({ id: `tl-3-${createdAt}`, status: 'in_transit', timestamp: iso(0, 2), title: 'Out for delivery', description: 'Rider on the way with your order.' });
    base.push({ id: `tl-4-${createdAt}`, status: 'delivered', timestamp: iso(0, 3), title: 'Delivered', description: 'Order delivered. Happy cooking!' });
  }
  if (status === 'in_transit') {
    base.push({ id: `tl-3-${createdAt}`, status: 'in_transit', timestamp: iso(0, 2), title: 'In transit', description: 'Produce moving from hub to your city.' });
  }
  if (status === 'out_for_delivery') {
    base.push({ id: `tl-3-${createdAt}`, status: 'out_for_delivery', timestamp: iso(0, 1), title: 'Out for delivery', description: 'Rider on the way with your order.' });
  }
  return base;
}

function buildOrder(
  id: string,
  orderNumber: string,
  userId: string,
  items: OrderItem[],
  status: Order['orderStatus'],
  daysAgo: number,
  producerId?: string
): SeedOrder {
  const subtotal = Math.round(items.reduce((s, i) => s + i.totalPrice, 0) * 100) / 100;
  const deliveryFee = 40;
  const platformFee = Math.round(subtotal * 0.02 * 100) / 100;
  const total = Math.round((subtotal + deliveryFee + platformFee) * 100) / 100;
  const createdAt = iso(-daysAgo);
  const order: Order = {
    id,
    orderNumber,
    userId,
    items,
    totalAmount: total,
    subtotal,
    deliveryFee,
    platformFee,
    discount: 0,
    farmerShare: Math.round(subtotal * 0.7 * 100) / 100,
    orderStatus: status,
    paymentStatus: status === 'cancelled' ? 'refunded' : 'paid',
    paymentMethod: 'upi',
    deliveryAddress: buildAddress('Coimbatore', 'Coimbatore', '641001', '12 Gandhi Street, R.S. Puram'),
    deliverySlot: { date: iso(1).slice(0, 10), startTime: '07:00', endTime: '11:00' },
    timeline: timeline(status, createdAt),
    createdAt,
    updatedAt: iso(-Math.max(0, daysAgo - 1)),
  };
  return producerId ? ({ ...order, producerId } as SeedOrder) : order;
}

function buildOrders(users: MockUser[], products: SeedProduct[]): SeedOrder[] {
  const consumer = users.find((u) => u.role === 'consumer')!;
  const consumer2 = users.filter((u) => u.role === 'consumer')[1]!;
  const farmer = users.find((u) => u.role === 'farmer')!;
  const byKey = (key: string) => products.find((p) => p.id === `prod-${key}`)!;

  const orders: SeedOrder[] = [
    buildOrder(
      'ord-1001',
      'VK-DEMO-01092026-4512',
      consumer.id,
      [orderItem(byKey('tomato'), 2), orderItem(byKey('brinjal'), 1), orderItem(byKey('ladyfinger'), 1)],
      'delivered',
      3
    ),
    buildOrder(
      'ord-1002',
      'VK-DEMO-04092026-8341',
      consumer2.id,
      [orderItem(byKey('banana'), 1), orderItem(byKey('coriander'), 2)],
      'delivered',
      5
    ),
    buildOrder(
      'ord-1003',
      'VK-DEMO-06092026-2287',
      consumer.id,
      [orderItem(byKey('organicrice'), 5), orderItem(byKey('varagu'), 2)],
      'processing',
      1
    ),
    buildOrder(
      'ord-1004',
      'VK-DEMO-07092026-7630',
      consumer.id,
      [orderItem(byKey('turmeric'), 1), orderItem(byKey('sirudhaniyam'), 1)],
      'confirmed',
      0
    ),
    buildOrder(
      'ord-1005',
      'VK-DEMO-02092026-1198',
      consumer2.id,
      [orderItem(byKey('onion'), 5), orderItem(byKey('greenchilli'), 1)],
      'cancelled',
      6
    ),
    buildOrder(
      'ord-1101',
      'VK-DEMO-08092026-5542',
      consumer.id,
      [orderItem(byKey('tomato'), 3), orderItem(byKey('drumstick'), 1)],
      'placed',
      0,
      farmer.id
    ),
    buildOrder(
      'ord-1102',
      'VK-DEMO-05092026-3918',
      consumer2.id,
      [orderItem(byKey('banana'), 2), orderItem(byKey('sweetpotato'), 3)],
      'in_transit',
      1,
      farmer.id
    ),
  ];
  return orders;
}

function buildForecasts(products: SeedProduct[]): Forecast[] {
  const now = iso(0);
  const daySec = 24 * 60 * 60 * 1000;
  const targets = [
    { prod: products.find((p) => p.id === 'prod-tomato')!, district: 'Coimbatore' },
    { prod: products.find((p) => p.id === 'prod-brinjal')!, district: 'Coimbatore' },
    { prod: products.find((p) => p.id === 'prod-onion')!, district: 'Tiruchirappalli' },
    { prod: products.find((p) => p.id === 'prod-banana')!, district: 'Tiruchirappalli' },
  ];
  const periods: Array<{ key: 'daily' | 'weekly' | 'monthly'; mult: number; label: string }> = [
    { key: 'daily', mult: 1, label: '' },
    { key: 'weekly', mult: 6.2, label: '' },
    { key: 'monthly', mult: 26, label: '' },
  ];
  const list: Forecast[] = [];
  let counter = 0;
  for (const t of targets) {
    for (const p of periods) {
      counter += 1;
      const base = 120 + (counter * 37) % 120;
      const predicted = Math.round(base * p.mult);
      list.push({
        id: `fc-${t.prod.id}-${p.key}`,
        productId: t.prod.id,
        productName: t.prod.name,
        category: t.prod.category,
        location: t.district,
        period: { from: new Date(Date.now() + daySec).toISOString(), to: new Date(Date.now() + p.mult * daySec).toISOString() },
        predictedDemandUnits: predicted,
        predictedPriceRange: { low: Math.round(t.prod.currentPricePerUnit * 0.92), high: Math.round(t.prod.currentPricePerUnit * 1.08) },
        confidenceScore: 0.78,
        confidence: 'medium',
        factors: ['Historical demand trend', 'Upcoming festival season', 'Recent harvest pattern'],
        weatherInfluence: 'Southwest monsoon likely to be normal',
        seasonality: ['Peak demand in festive weeks', 'Lower demand during monsoon floods'],
        marketTrends: ['Retail prices expected stable', 'Institutional demand rising'],
        recommendedAction: 'Stock up for the next 7-day window to meet forecast demand.',
        recommendedPlantingQuantity: `${Math.round(predicted / 4)} kg`,
        advisoryNotes: 'Advisory estimate based on demo data. Re-verify before large commitments.',
        lastUpdated: now,
      });
    }
  }
  return list;
}

function buildRecommendations(): Recommendation[] {
  return [
    {
      id: 'rec-1',
      type: 'demand',
      title: 'Demand expected to rise for Tomato',
      description: 'Demand for tomatoes in Coimbatore is expected to increase 18% next week. Current stock covers 71% of expected demand.',
      priority: 'high',
      actionable: true,
      createdAt: iso(-1),
      expiresAt: iso(3),
      metadata: { product: 'Tomato', district: 'Coimbatore', increase_pct: 18 },
    },
    {
      id: 'rec-2',
      type: 'stock',
      title: 'Onion stock above expected demand',
      description: 'Current onion stock in Tiruchirappalli exceeds forecast demand. Consider reducing harvest deliveries to this location.',
      priority: 'medium',
      actionable: true,
      createdAt: iso(-2),
      expiresAt: iso(2),
      metadata: { product: 'Onion', district: 'Tiruchirappalli' },
    },
    {
      id: 'rec-3',
      type: 'demand',
      title: 'FPO can fulfil 300 kg tomato order',
      description: 'Aggregate capacity exists for the daily 300 kg hotel requirement. Suggested collection at Thondamuthur hub by 4:00 AM.',
      priority: 'high',
      actionable: true,
      createdAt: iso(-1),
      expiresAt: iso(3),
      metadata: { fpo: 'Kongunadu FPO', quantity_kg: 300, collection_center: 'Thondamuthur' },
    },
  ];
}

function buildBulkRequirements(users: MockUser[]): BulkRequirement[] {
  const bulk = users.find((u) => u.role === 'bulk_buyer')!;
  return [
    {
      id: 'brq-1',
      buyerId: bulk.id,
      buyerName: bulk.full_name,
      buyerCompany: 'Sahana Grand Hotel',
      productName: 'Tomato',
      productCategory: 'vegetables',
      quantity: 300,
      unit: 'kg',
      preferredGrade: 'A',
      budgetPerUnit: 28,
      deliveryLocation: buildAddress('Chennai', 'Chennai', '600001', '18 Mount Road'),
      deliveryDeadline: iso(3),
      recurring: true,
      frequency: 'daily',
      description: 'Daily requirement for hotel kitchen. Uniform, deep red, no blemishes.',
      status: 'open',
      quotationDeadline: iso(2),
      quotationsCount: 1,
      createdAt: iso(-1),
    },
    {
      id: 'brq-2',
      buyerId: bulk.id,
      buyerName: bulk.full_name,
      buyerCompany: 'Verma Fresh Mart',
      productName: 'Banana (Poovan)',
      productCategory: 'fruits',
      quantity: 100,
      unit: 'dozen',
      preferredGrade: 'A',
      budgetPerUnit: 48,
      deliveryLocation: buildAddress('Coimbatore', 'Coimbatore', '641001', '44 Cross Cut Road'),
      deliveryDeadline: iso(5),
      recurring: false,
      description: 'Weekend stock for retail outlet.',
      status: 'quoted',
      quotationDeadline: iso(4),
      quotationsCount: 2,
      createdAt: iso(-2),
    },
  ];
}

function buildServiceAreas(): ServiceArea[] {
  return [
    { id: 'sa-chennai', district: 'Chennai', pincode: '600001', isActive: true, deliveryEnabled: true, deliveryFee: 60, minOrderAmount: 200, avgDeliveryTimeMins: 720, slotsAvailable: ['07:00-11:00', '17:00-21:00'] },
    { id: 'sa-coimbatore', district: 'Coimbatore', pincode: '641001', isActive: true, deliveryEnabled: true, deliveryFee: 40, minOrderAmount: 150, avgDeliveryTimeMins: 480, slotsAvailable: ['07:00-11:00', '17:00-21:00'] },
    { id: 'sa-trichy', district: 'Tiruchirappalli', pincode: '620001', isActive: true, deliveryEnabled: true, deliveryFee: 35, minOrderAmount: 150, avgDeliveryTimeMins: 480, slotsAvailable: ['07:00-11:00'] },
  ];
}

function buildReviews(products: SeedProduct[]): Review[] {
  const reviewers = [
    { id: 'u-r1', name: 'Kavitha M' },
    { id: 'u-r2', name: 'Ramesh V' },
    { id: 'u-r3', name: 'Deepa N' },
  ];
  const list: Review[] = [];
  const sample = ['Very fresh, arrived on time!', 'Good quality produce, packed well.', 'Taste is great, will order again.'];
  products.forEach((prod, i) => {
    list.push({
      id: `rv-${prod.id}`,
      productId: prod.id,
      userId: reviewers[i % reviewers.length].id,
      userName: reviewers[i % reviewers.length].name,
      rating: 4 + (i % 2),
      comment: sample[i % sample.length],
      verifiedPurchase: true,
      createdAt: iso(-i - 2),
    });
  });
  return list;
}

function buildProductListings(users: MockUser[], products: SeedProduct[]): ProductListing[] {
  const far = users.find((u) => u.role === 'farmer')!;
  return products.slice(0, 6).map((p, i) => ({
    id: `pl-${p.id}`,
    productId: p.id,
    productName: p.name,
    pricePerUnit: p.currentPricePerUnit,
    wholesalePrice: Math.round(p.currentPricePerUnit * 0.85 * 100) / 100,
    grade: p.grade,
    availableQuantity: p.availableQuantity,
    minOrderQuantity: p.minOrderQuantity,
    locationDistrict: p.sourceLocation.district,
    producerType: p.farmerId === far.id ? 'farmer' : 'fpo',
    status: 'active',
    createdAt: iso(-i),
  }));
}

export function buildSeedDB(): MockDB {
  const users: MockUser[] = [
    user('u-admin', 'Admin Officer', '9810000000', 'admin@vaikkal.in', 'admin'),
    user('u-farmer', 'Murugan K', '9820000001', 'farmer1@vaikkal.in', 'farmer'),
    user('u-farmer2', 'Meenakshi R', '9820000002', 'farmer2@vaikkal.in', 'farmer'),
    user('u-fpo', 'Kongunadu FPO', '9830000001', 'fpo1@vaikkal.in', 'fpo_admin'),
    user('u-bulk', 'Sahana Grand Hotel', '9840000001', 'buyer-hotel@vaikkal.in', 'bulk_buyer'),
    user('u-delivery', 'Suresh Driver', '9850000001', 'delivery1@vaikkal.in', 'delivery_partner'),
    user('u-consumer', 'Priya S', '9860000001', 'consumer1@vaikkal.in', 'consumer'),
    user('u-consumer2', 'Arun B', '9860000002', 'consumer2@vaikkal.in', 'consumer'),
    user('u-operator', 'Kannan P', '9870000001', 'operator1@vaikkal.in', 'collection_center_operator'),
    user('u-support', 'Support Desk', '9880000001', 'support@vaikkal.in', 'support'),
  ];

  const categories: Category[] = CATEGORIES.map((c) => ({
    ...c,
    productCount: 1,
    isActive: true,
  }));

  const products = buildProducts(users);
  const categoriesWithCounts = categories.map((c) => ({
    ...c,
    productCount: products.filter((p) => p.category === c.name).length,
  }));

  const db: MockDB = {
    version: 1,
    users,
    profiles: profiles(users),
    categories: categoriesWithCounts,
    products,
    productListings: buildProductListings(users, products),
    carts: {},
    orders: buildOrders(users, products),
    forecasts: buildForecasts(products),
    recommendations: buildRecommendations(),
    bulkRequirements: buildBulkRequirements(users),
    serviceAreas: buildServiceAreas(),
    payments: {},
    reviews: buildReviews(products),
  };
  return db;
}