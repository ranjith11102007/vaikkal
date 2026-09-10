import type {
  Address,
  Cart,
  CartItem,
  Category,
  FarmerProfile,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  Review,
  ServiceArea,
  User,
  UserRole,
} from '@/types';
import { loadDB, nowIso, persistDB, uid } from './db';
import { MockDB, MockUser, ProductListing, SeedProduct } from './types';
import { DEMO_PASSWORD } from './seed';

export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, unknown>;
  body: unknown;
  authHeader: string;
}

export interface MockResponse {
  status: number;
  data: unknown;
}

class HttpError {
  constructor(readonly status: number, readonly data: Record<string, unknown>) {}
}

function fail(status: number, message: string): never {
  throw new HttpError(status, { detail: message });
}

function ok(data: unknown): MockResponse {
  return { status: 200, data };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function segsOf(path: string): string[] {
  let p = path;
  const apiIdx = p.indexOf('/api/');
  if (apiIdx !== -1) {
    p = p.slice(apiIdx + 5);
    if (p.startsWith('backend/api/v1/')) p = p.slice('backend/api/v1/'.length);
    else if (p.startsWith('backend/api/v1')) p = p.slice('backend/api/v1'.length);
    else if (p.startsWith('v1/')) p = p.slice(3);
  }
  return p.split('/').filter(Boolean);
}

export function parseQuery(qs: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!qs) return out;
  for (const [k, v] of new URLSearchParams(qs).entries()) {
    out[k] = v;
  }
  return out;
}

function authEnvelope(u: MockUser) {
  return {
    access_token: `mock-token-${u.id}`,
    refresh_token: `mock-refresh-${u.id}`,
    user: {
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      is_verified: u.is_verified,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
    },
  };
}

function toFrontendUser(u: MockUser): User {
  return {
    id: u.id,
    name: u.full_name,
    phoneNumber: u.phone ?? '',
    email: u.email ?? undefined,
    role: u.role as UserRole,
    status: u.is_verified ? 'verified' : 'active',
    language: 'ta',
    prefersDarkMode: false,
    photoUrl: u.avatar_url ?? undefined,
    registeredAt: u.created_at,
    emailVerified: u.is_verified,
  };
}

function optionalUser(req: MockRequest, db: MockDB): MockUser | null {
  const m = /^Bearer\s+(.+)$/i.exec((req.authHeader ?? '').trim());
  if (!m) return null;
  const token = m[1].trim();
  if (!token.startsWith('mock-token-')) return null;
  const id = token.slice('mock-token-'.length);
  return db.users.find((u) => u.id === id) ?? null;
}

function requiredUser(req: MockRequest, db: MockDB): MockUser {
  const u = optionalUser(req, db);
  if (!u) fail(401, 'Not authenticated');
  return u!;
}

function profileFor(db: MockDB, userId: string): FarmerProfile | null {
  return db.profiles[userId] ?? null;
}

function ensureProfile(db: MockDB, u: MockUser): FarmerProfile {
  const existing = db.profiles[u.id];
  if (existing) return existing;
  const fallback: FarmerProfile = {
    id: `fp-${u.id}`,
    userId: u.id,
    farmName: u.full_name,
    farmSizeAcres: 1,
    cropsGrown: [],
    district: 'Coimbatore',
    village: '',
    state: 'Tamil Nadu',
    languagesSpoken: ['English'],
    kycDocuments: [],
    bankAccount: {
      accountNumberMasked: 'XXXXXXXX0000',
      ifsc: 'SBIN0000000',
      bankName: 'State Bank of India',
      accountHolderName: u.full_name,
    },
    bio: '',
    certifications: [],
    yearsOfExperience: 1,
    averageRating: 4.5,
    totalRatings: 0,
    settlementsEnabled: true,
    preferredLanguages: ['en'],
  };
  db.profiles[u.id] = fallback;
  return fallback;
}

function emptyCart(userId?: string): Cart {
  const now = nowIso();
  return {
    id: userId ? `cart-${userId}` : 'cart-guest',
    userId,
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    platformFee: 0,
    total: 0,
    estimatedFarmerShare: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function recomputeCart(cart: Cart): void {
  const subtotal = round2(cart.items.reduce((s, i) => s + i.pricePerUnit * i.quantity, 0));
  const deliveryFee = 40;
  const platformFee = round2(subtotal * 0.02);
  cart.subtotal = subtotal;
  cart.deliveryFee = deliveryFee;
  cart.platformFee = platformFee;
  cart.total = round2(subtotal + deliveryFee + platformFee);
  cart.estimatedFarmerShare = round2(subtotal * 0.7);
  cart.updatedAt = nowIso();
}

function getCart(db: MockDB, userId?: string): Cart {
  if (!userId) return emptyCart();
  if (!db.carts[userId]) db.carts[userId] = emptyCart(userId);
  return db.carts[userId];
}

function paginate<T>(items: T[], total: number, page: number, perPage: number) {
  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

function listProducts(db: MockDB, params: Record<string, unknown>, mineFor?: MockUser) {
  let list = db.products.slice();
  const mine = params.mine === 'true' || params.mine === true;
  const featured = params.featured === 'true' || params.featured === true;
  const nearby = params.nearby === 'true' || params.nearby === true;

  if (mine) {
    if (!mineFor) return paginate([], 0, 1, Number(params.per_page) || 12);
    list = list.filter((p) => p.farmerId === mineFor.id);
  } else {
    list = list.filter((p) => p.status === 'approved' && p.stockStatus !== 'out_of_stock');
  }
  if (nearby) {
    list = list.filter((p) => p.stockStatus !== 'out_of_stock');
  }
  if (featured) {
    list = list.filter((p) => Boolean((p as SeedProduct).featured));
  }

  const q = String(params.q ?? '').trim().toLowerCase();
  if (q) {
    list = list.filter((p) => `${p.name} ${p.nameTa} ${p.description}`.toLowerCase().includes(q));
  }

  const category = String(params.category ?? '');
  if (category && category !== 'all' && category !== 'ALL') {
    list = list.filter((p) => p.category === category);
  }

  if (params.organic === 'true') {
    list = list.filter((p) => p.isOrganic || p.isOrganicCertified);
  }

  const priceMin = Number(params.price_min);
  if (Number.isFinite(priceMin) && String(params.price_min) !== '') {
    list = list.filter((p) => p.currentPricePerUnit >= priceMin);
  }
  const priceMax = Number(params.price_max);
  if (Number.isFinite(priceMax) && String(params.price_max) !== '') {
    list = list.filter((p) => p.currentPricePerUnit <= priceMax);
  }

  const grades = String(params.grades ?? '').trim();
  if (grades) {
    const set = grades.split(',').map((s) => s.trim()).filter(Boolean);
    list = list.filter((p) => set.includes(p.grade));
  }

  const producerType = String(params.producer_type ?? '').trim();
  if (producerType) {
    list = list.filter((p) => p.producer.entityType === producerType);
  }

  const sort = String(params.sort ?? 'popular');
  if (sort === 'price_asc') list.sort((a, b) => a.currentPricePerUnit - b.currentPricePerUnit);
  else if (sort === 'price_desc') list.sort((a, b) => b.currentPricePerUnit - a.currentPricePerUnit);
  else list.sort((a, b) => b.avgRating - a.avgRating || b.totalRatings - a.totalRatings);

  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.max(1, Number(params.per_page) || 12);
  const total = list.length;
  const start = (page - 1) * perPage;
  return paginate(list.slice(start, start + perPage), total, page, perPage);
}

function toAddress(raw: unknown): Address {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: `addr-${uid('addr')}`,
    label: String(r.label ?? 'Home'),
    addressLine1: String(r.addressLine1 ?? r.address_line1 ?? r.street ?? r.city ?? r.district ?? ''),
    city: String(r.city ?? ''),
    district: String(r.district ?? ''),
    state: String(r.state ?? 'Tamil Nadu'),
    pincode: String(r.pincode ?? ''),
  };
}

function newOrderNumber(): string {
  const ymd = nowIso().slice(0, 10).replace(/-/g, '');
  let n = '';
  for (let i = 0; i < 4; i++) n += String(Math.floor(Math.random() * 10));
  return `VK-DEMO-${ymd}-${n}`;
}

function entityTypeOf(u: MockUser): 'farmer' | 'fpo' {
  if (u.role === 'farmer') return 'farmer';
  if (u.role === 'fpo' || u.role === 'fpo_admin') return 'fpo';
  return 'farmer';
}

function createProductFromBody(db: MockDB, u: MockUser, body: Record<string, unknown>): SeedProduct {
  const category = db.categories.find(
    (c) => c.id === body.category_id || c.name === body.category_slug
  );
  const profile = profileFor(db, u.id);
  const prod: SeedProduct = {
    id: uid('prod'),
    categoryId: category?.id ?? 'cat-vegetables',
    category: (category?.name ?? body.category_slug ?? 'vegetables') as Product['category'],
    name: String(body.name ?? 'New Product'),
    nameTa: String(body.name_tamil ?? ''),
    description: String(body.description ?? ''),
    images: body.image_url ? [String(body.image_url)] : [],
    unit: String(body.unit ?? 'kg'),
    basePricePerUnit: 0,
    currentPricePerUnit: 0,
    minOrderQuantity: 1,
    availableQuantity: 0,
    farmerId: u.id,
    producer: { id: u.id, name: u.full_name, entityType: entityTypeOf(u) },
    sourceLocation: {
      district: profile?.district ?? 'Coimbatore',
      village: profile?.village,
      state: 'Tamil Nadu',
    },
    grade: 'A',
    packagingType: 'Standard pack',
    harvestDate: nowIso(),
    shelfLifeDays: 5,
    deliveryEstimateMins: 60,
    isOrganic: false,
    isOrganicCertified: false,
    certifications: [],
    stockStatus: 'out_of_stock',
    status: 'approved',
    avgRating: 0,
    totalRatings: 0,
    tags: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return prod;
}

function applyListing(db: MockDB, body: Record<string, unknown>): ProductListing {
  const pid = String(body.product_id ?? '');
  const product = db.products.find((p) => p.id === pid);
  if (!product) fail(404, 'Product not found');
  const price = Number(body.price_per_unit ?? 0);
  const qty = Number(body.available_quantity ?? 0);
  product.currentPricePerUnit = price;
  product.basePricePerUnit = price;
  product.grade = (body.grade as Product['grade']) ?? product.grade;
  product.availableQuantity = qty;
  product.minOrderQuantity = Number(body.min_order_quantity ?? product.minOrderQuantity);
  product.isOrganicCertified = Boolean(body.organic_certified);
  product.isOrganic = product.isOrganicCertified;
  if (body.harvest_date) product.harvestDate = String(body.harvest_date);
  if (body.location_district) product.sourceLocation.district = String(body.location_district);
  product.stockStatus = qty <= 0 ? 'out_of_stock' : qty < 20 ? 'low_stock' : 'in_stock';
  product.updatedAt = nowIso();
  const listing: ProductListing = {
    id: uid('pl'),
    productId: product.id,
    productName: product.name,
    pricePerUnit: price,
    wholesalePrice: body.wholesale_price ? Number(body.wholesale_price) : undefined,
    grade: product.grade,
    availableQuantity: qty,
    minOrderQuantity: product.minOrderQuantity,
    locationDistrict: product.sourceLocation.district,
    producerType: entityTypeOf(requiredUserForListing(db, product.farmerId)),
    status: String(body.status ?? 'active'),
    createdAt: nowIso(),
  };
  db.productListings.push(listing);
  return listing;
}

function requiredUserForListing(db: MockDB, id: string): MockUser {
  const u = db.users.find((x) => x.id === id);
  return u ?? { id, full_name: 'Producer', phone: null, email: null, password: '', role: 'farmer', is_verified: true, avatar_url: null, created_at: nowIso() };
}

function handleAuth(req: MockRequest, db: MockDB, segs: string[]): MockResponse {
  const action = segs[1];
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (req.method === 'post' && action === 'login') {
    if (body.identifier && body.password) {
      const ident = String(body.identifier).trim().toLowerCase();
      const u = db.users.find(
        (x) => (x.email?.toLowerCase() === ident) || (x.phone === String(body.identifier).trim())
      );
      if (!u || u.password !== String(body.password)) fail(401, 'Invalid credentials');
      return ok(authEnvelope(u!));
    }
    if (body.email && body.password) {
      const u = db.users.find((x) => x.email?.toLowerCase() === String(body.email).toLowerCase());
      if (!u || u.password !== String(body.password)) fail(401, 'Invalid credentials');
      return ok(authEnvelope(u!));
    }
    if (body.phone && body.otp) {
      const u = db.users.find((x) => x.phone === String(body.phone));
      if (!u) fail(401, 'No account found for this number');
      return ok(authEnvelope(u!));
    }
    fail(400, 'Invalid login request');
  }

  if (req.method === 'post' && action === 'send-otp') {
    return ok({ otpSent: true, otp: '123456' });
  }

  if (req.method === 'post' && action === 'verify-otp') {
    const u = db.users.find((x) => x.phone === String(body.phone ?? ''));
    if (!u) fail(401, 'No account found for this number. Try a demo account or create one.');
    const otp = String(body.otp ?? '');
    if (!/^\d{6}$/.test(otp)) fail(400, 'Invalid OTP. Please enter the 6-digit code sent to your phone.');
    return ok(authEnvelope(u!));
  }

  if (req.method === 'post' && action === 'register') {
    const email = body.email ? String(body.email).toLowerCase() : null;
    const phone = body.phone ? String(body.phone) : null;
    if (
      db.users.some((x) => (email && x.email === email) || (phone && x.phone === phone))
    ) {
      fail(409, 'An account with this email or phone already exists');
    }
    const newUser: MockUser = {
      id: uid('u'),
      full_name: String(body.full_name ?? 'User'),
      phone,
      email,
      password: String(body.password ?? DEMO_PASSWORD),
      role: String(body.role ?? 'consumer'),
      is_verified: true,
      avatar_url: null,
      created_at: nowIso(),
    };
    db.users.push(newUser);
    if (newUser.role === 'farmer' || newUser.role === 'fpo' || newUser.role === 'fpo_admin') {
      ensureProfile(db, newUser);
    }
    return ok(authEnvelope(newUser));
  }

  if (req.method === 'post' && action === 'logout') {
    return ok({ success: true });
  }

  if (req.method === 'post' && action === 'refresh') {
    const token = String(body.refresh_token ?? body.refreshToken ?? '');
    if (!token.startsWith('mock-refresh-')) fail(401, 'Invalid refresh token');
    const id = token.slice('mock-refresh-'.length);
    const u = db.users.find((x) => x.id === id);
    if (!u) fail(401, 'Invalid refresh token');
    return ok({ accessToken: `mock-token-${u!.id}`, refreshToken: `mock-refresh-${u!.id}` });
  }

  if (req.method === 'patch' && action === 'me') {
    const u = requiredUser(req, db);
    if (typeof body.name === 'string' && body.name) u.full_name = String(body.name);
    if (typeof body.phoneNumber === 'string' && body.phoneNumber) u.phone = String(body.phoneNumber);
    if (typeof body.email === 'string') u.email = body.email ? String(body.email) : null;
    if (typeof body.photoUrl === 'string' && body.photoUrl) u.avatar_url = String(body.photoUrl);
    if (typeof body.language === 'string') {
      // preference stored on frontend store only
    }
    return ok({ user: toFrontendUser(u) });
  }

  return fail(404, 'Not found');
}

function handleProductReq(req: MockRequest, db: MockDB, segs: string[]): MockResponse {
  const method = req.method;

  if (method === 'get') {
    if (segs.length === 1) {
      return ok(listProducts(db, req.params, optionalUser(req, db) ?? undefined));
    }
    if (segs[1] === 'search') {
      return ok(listProducts(db, { ...req.params }, optionalUser(req, db) ?? undefined));
    }
    const p = db.products.find((x) => x.id === segs[1]);
    if (!p) fail(404, 'Product not found');
    return ok({
      product: p,
      recommendations: db.recommendations,
      reviews: db.reviews.filter((r) => r.productId === p.id),
    });
  }

  if (method === 'post' && segs[1] === 'listings') {
    return ok(applyListing(db, (req.body ?? {}) as Record<string, unknown>));
  }

  if (method === 'post') {
    const u = requiredUser(req, db);
    const prod = createProductFromBody(db, u, (req.body ?? {}) as Record<string, unknown>);
    db.products.push(prod);
    return ok(prod);
  }

  if (method === 'patch' && segs[1]) {
    const u = requiredUser(req, db);
    const p = db.products.find((x) => x.id === segs[1]);
    if (!p) fail(404, 'Product not found');
    if (p.farmerId !== u.id && u.role !== 'admin') fail(403, 'Not allowed to edit this product');
    const patch = (req.body ?? {}) as Record<string, unknown>;
    const keys = ['name', 'nameTa', 'description', 'unit', 'basePricePerUnit', 'currentPricePerUnit', 'minOrderQuantity', 'availableQuantity', 'grade', 'stockStatus', 'status', 'packagingType', 'isOrganic', 'isOrganicCertified', 'avgRating', 'totalRatings'] as const;
    for (const k of keys) {
      if (patch[k] !== undefined) (p as unknown as Record<string, unknown>)[k] = patch[k];
    }
    if (patch.availableQuantity !== undefined) {
      const qty = Number(patch.availableQuantity);
      p.stockStatus = qty <= 0 ? 'out_of_stock' : qty < 20 ? 'low_stock' : 'in_stock';
    }
    p.updatedAt = nowIso();
    return ok({ id: p.id });
  }

  if (method === 'delete' && segs[1]) {
    const u = requiredUser(req, db);
    const idx = db.products.findIndex((x) => x.id === segs[1]);
    if (idx === -1) fail(404, 'Product not found');
    if (db.products[idx].farmerId !== u.id && u.role !== 'admin') fail(403, 'Not allowed to delete this product');
    const [removed] = db.products.splice(idx, 1);
    return ok({ id: removed.id });
  }

  return fail(404, 'Not found');
}

function handleOrderReq(req: MockRequest, db: MockDB, segs: string[]): MockResponse {
  const method = req.method;

  if (method === 'get' && segs.length === 1) {
    const u = requiredUser(req, db);
    const mine = req.params.mine === 'true' || req.params.mine === true;
    const isProducer = u.role === 'farmer' || u.role === 'fpo' || u.role === 'fpo_admin';
    let list = db.orders.filter((o) => {
      if (mine) return o.producerId === u.id;
      if (isProducer) return o.userId === u.id || o.producerId === u.id;
      return o.userId === u.id;
    });
    const status = String(req.params.status ?? '');
    if (status) list = list.filter((o) => o.orderStatus === status);
    list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = Math.max(1, Number(req.params.page) || 1);
    const perPage = Math.max(1, Number(req.params.per_page) || 10);
    const total = list.length;
    const start = (page - 1) * perPage;
    return ok(paginate(list.slice(start, start + perPage), total, page, perPage));
  }

  if (method === 'get' && segs[1]) {
    const u = optionalUser(req, db);
    let order = db.orders.find((o) => o.id === segs[1] || o.orderNumber === segs[1]);
    if (!order && u) {
      order = [...db.orders]
        .filter((o) => o.userId === u.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    }
    if (!order) fail(404, 'Order not found');
    return ok({ order });
  }

  if (method === 'post' && segs[1] === 'cart' && segs[2] === 'items') {
    const u = requiredUser(req, db);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = db.products.find((p) => p.id === String(body.product_listing_id ?? ''));
    if (!product) fail(404, 'Listing not found');
    const qty = Math.max(1, Number(body.quantity ?? 1));
    const cart = getCart(db, u.id);
    const existing = cart.items.find((i) => i.productId === product.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      const ci: CartItem = {
        id: uid('ci'),
        productId: product.id,
        product,
        quantity: qty,
        unit: product.unit,
        pricePerUnit: product.currentPricePerUnit,
        farmerShare: round2(product.currentPricePerUnit * qty * 0.7),
        addedAt: nowIso(),
      };
      cart.items.push(ci);
    }
    recomputeCart(cart);
    db.carts[u.id] = cart;
    return ok({ id: existing?.id ?? uid('ci') });
  }

  if (method === 'post' && segs[1] === 'checkout') {
    const u = requiredUser(req, db);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const cart = db.carts[u.id];
    const cartItems = cart?.items ?? [];
    if (cartItems.length === 0) fail(400, 'Your cart is empty. Add items before checkout.');

    const orderItems: OrderItem[] = cartItems.map((i) => ({
      id: uid('oi'),
      productId: i.productId,
      productName: i.product?.name ?? 'Item',
      quantity: i.quantity,
      unit: i.unit,
      pricePerUnit: i.pricePerUnit,
      totalPrice: round2(i.pricePerUnit * i.quantity),
      farmerShareAmount: round2(i.pricePerUnit * i.quantity * 0.7),
    }));

    const subtotal = round2(orderItems.reduce((s, i) => s + i.totalPrice, 0));
    const deliveryFee = 40;
    const platformFee = round2(subtotal * 0.02);
    const total = round2(subtotal + deliveryFee + platformFee);
    const now = nowIso();
    const methodName = String(body.payment_method ?? 'upi') as PaymentMethod;

    const deliveryAddress = toAddress(body.delivery_address_json);
    const order: Order = {
      id: uid('ord'),
      orderNumber: newOrderNumber(),
      userId: u.id,
      items: orderItems,
      totalAmount: total,
      subtotal,
      deliveryFee,
      platformFee,
      discount: 0,
      farmerShare: round2(subtotal * 0.7),
      orderStatus: 'placed',
      paymentStatus: 'pending',
      paymentMethod: methodName,
      deliveryAddress,
      deliverySlot: {
        date: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
        startTime: '07:00',
        endTime: '11:00',
      },
      timeline: [
        { id: uid('tl'), status: 'placed', timestamp: now, title: 'Order placed', description: 'Order received and confirmed by the platform.' },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const producerId = db.products.find((p) => p.id === orderItems[0]?.productId)?.farmerId;
    (order as Order & { producerId?: string }).producerId = producerId;

    const productAny = db.products.find((p) => p.id === orderItems[0]?.productId) as SeedProduct | undefined;

    const paymentId = uid('pay');
    db.payments[paymentId] = {
      id: paymentId,
      orderId: order.id,
      amount: total,
      method: methodName,
      gatewayReference: `MOCK-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
      processedAt: now,
    };
    db.orders.unshift(order);
    delete db.carts[u.id];
    return ok({ order, payment: { id: paymentId }, message: 'Order placed successfully' });
  }

  if (method === 'post' && segs[1] === 'payment' && segs[2] === 'complete') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const paymentId = String(body.payment_id ?? '');
    const payment = db.payments[paymentId];
    if (!payment) fail(404, 'Payment not found');
    payment.status = 'paid';
    payment.processedAt = nowIso();
    const order = db.orders.find((o) => o.id === payment.orderId);
    if (order) {
      order.paymentStatus = 'paid';
      order.updatedAt = nowIso();
    }
    return ok({ id: paymentId });
  }

  if (method === 'post' && segs[1] && segs[2] === 'cancel') {
    const u = requiredUser(req, db);
    const order = db.orders.find((o) => o.id === segs[1] || o.orderNumber === segs[1]);
    if (!order) fail(404, 'Order not found');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const now = nowIso();
    order.orderStatus = 'cancelled';
    order.paymentStatus = 'refunded';
    order.cancellation = {
      reason: String(body.reason ?? 'No reason provided'),
      cancelledBy: u.full_name,
      timestamp: now,
    };
    order.timeline.push({
      id: uid('tl'),
      status: 'cancelled',
      timestamp: now,
      title: 'Order cancelled',
      description: 'Cancelled as requested. Refund initiated.',
    });
    order.updatedAt = now;
    return ok(order);
  }

  return fail(404, 'Not found');
}

function handleLocationReq(req: MockRequest, db: MockDB, segs: string[]): MockResponse {
  if (req.method === 'get' && (segs[1] === 'check' || segs[1] === 'service-areas') && segs.includes('check')) {
    const pincode = String(req.params.pincode ?? '');
    const area = db.serviceAreas.find((a) => pincode.startsWith(a.pincode.slice(0, 3)));
    if (area) return ok({ serviceArea: area });
    const fallback: ServiceArea = {
      id: 'sa-default',
      district: 'Tamil Nadu',
      pincode: pincode || '000000',
      isActive: true,
      deliveryEnabled: true,
      deliveryFee: 50,
      minOrderAmount: 150,
      avgDeliveryTimeMins: 600,
      slotsAvailable: ['07:00-11:00', '17:00-21:00'],
    };
    return ok({ serviceArea: fallback });
  }
  if (req.method === 'get' && segs[0] === 'service-areas' && segs[1] === 'check') {
    const pincode = String(req.params.pincode ?? '');
    const area = db.serviceAreas.find((a) => pincode.startsWith(a.pincode.slice(0, 3)));
    if (area) return ok({ serviceArea: area });
    const fallback: ServiceArea = {
      id: 'sa-default',
      district: 'Tamil Nadu',
      pincode: pincode || '000000',
      isActive: true,
      deliveryEnabled: true,
      deliveryFee: 50,
      minOrderAmount: 150,
      avgDeliveryTimeMins: 600,
      slotsAvailable: ['07:00-11:00', '17:00-21:00'],
    };
    return ok({ serviceArea: fallback });
  }
  if (req.method === 'get' && segs[0] === 'geocode' && segs[1] === 'reverse') {
    const lat = Number(req.params.lat);
    const district = lat > 11 ? 'Chennai' : lat > 10.5 ? 'Coimbatore' : 'Tiruchirappalli';
    return ok({ address: `${district}, Tamil Nadu`, district, pincode: district === 'Chennai' ? '600001' : district === 'Coimbatore' ? '641001' : '620001' });
  }
  return fail(404, 'Not found');
}

function handleRequest(req: MockRequest, db: MockDB): MockResponse {
  const path = segsOf(req.path);
  const [m0, m1] = path;
  const method = req.method;

  if (!m0) return fail(404, 'Not found');

  if (m0 === 'auth') return handleAuth(req, db, path);

  if (m0 === 'categories' && method === 'get') {
    return ok(db.categories as unknown as Category[]);
  }

  if (m0 === 'products') return handleProductReq(req, db, path);

  if (m0 === 'cart') {
    if (method === 'get') {
      const u = optionalUser(req, db);
      return ok(getCart(db, u?.id));
    }
    if (method === 'patch' && path[1] === 'items' && path[2]) {
      const u = requiredUser(req, db);
      const cart = getCart(db, u.id);
      const item = cart.items.find((i) => i.productId === path[2]);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const qty = Number(body.quantity ?? 1);
      if (item) {
        item.quantity = qty;
        if (qty <= 0) cart.items = cart.items.filter((i) => i.productId !== path[2]);
      }
      recomputeCart(cart);
      db.carts[u.id] = cart;
      return ok(cart);
    }
    return fail(404, 'Not found');
  }

  if (m0 === 'orders') return handleOrderReq(req, db, path);

  if (m0 === 'forecasts' && method === 'get') {
    const productId = String(req.params.product_id ?? req.params.product ?? '');
    let list = db.forecasts;
    if (productId) list = list.filter((f) => f.productId === productId);
    return ok(list);
  }

  if (m0 === 'recommendations' && method === 'get') {
    return ok(db.recommendations);
  }

  if (m0 === 'producers') {
    if (method === 'get' && m1 === 'me') {
      const u = requiredUser(req, db);
      return ok({ profile: ensureProfile(db, u) });
    }
    if (method === 'get' && m1) {
      const profile =
        db.profiles[m1] ?? Object.values(db.profiles).find((p) => p.id === m1) ?? null;
      if (!profile) fail(404, 'Producer not found');
      return ok({ profile });
    }
  }

  if (m0 === 'bulk' && m1 === 'requirements') {
    if (method === 'get') {
      const u = optionalUser(req, db);
      let list = db.bulkRequirements;
      if (u?.role === 'bulk_buyer') {
        list = list.filter((r) => r.buyerId === u.id || r.status === 'open');
      } else if (u && (u.role === 'farmer' || u.role === 'fpo' || u.role === 'fpo_admin')) {
        list = list.filter((r) => r.status === 'open' || r.status === 'quoted');
      }
      return ok(list);
    }
    if (method === 'post') {
      const u = requiredUser(req, db);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const requirement = {
        id: uid('brq'),
        buyerId: u.id,
        buyerName: u.full_name,
        buyerCompany: String(body.company_name ?? body.buyerCompany ?? ''),
        productName: String(body.product_name ?? 'Product'),
        productCategory: (body.product_category ?? 'vegetables') as Product['category'],
        quantity: Number(body.quantity ?? 1),
        unit: String(body.unit ?? 'kg'),
        preferredGrade: body.preferred_grade ? String(body.preferred_grade) : undefined,
        budgetPerUnit: body.budget_per_unit !== undefined ? Number(body.budget_per_unit) : undefined,
        deliveryLocation: toAddress(body.delivery_address ?? body.deliveryLocation),
        deliveryDeadline: String(body.delivery_deadline ?? new Date(Date.now() + 7 * 86400000).toISOString()),
        recurring: Boolean(body.recurring),
        frequency: body.frequency as 'daily' | 'weekly' | 'monthly' | undefined,
        description: body.description ? String(body.description) : undefined,
        status: 'open' as const,
        quotationDeadline: String(body.quotation_deadline ?? new Date(Date.now() + 5 * 86400000).toISOString()),
        createdAt: nowIso(),
      };
      db.bulkRequirements.unshift(requirement);
      return ok(requirement);
    }
  }

  if (m0 === 'service-areas') return handleLocationReq(req, db, path);
  if (m0 === 'geocode') return handleLocationReq(req, db, path);

  return fail(404, 'Not found');
}

export function routeMockRequest(req: MockRequest): MockResponse {
  const db = loadDB();
  let res: MockResponse;
  try {
    res = handleRequest(req, db);
  } catch (e) {
    if (e instanceof HttpError) {
      res = { status: e.status, data: e.data };
    } else {
      console.error('Mock router error', e);
      res = { status: 500, data: { detail: 'Mock service error' } };
    }
  }
  persistDB(db);
  return res;
}