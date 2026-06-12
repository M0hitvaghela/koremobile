import { Product } from '../types/product';

export const DUMMY_PRODUCTS: Product[] = [
{
  id: '1',
  slug: 'samsung-galaxy-a55',
  name: 'Samsung Galaxy A55 5G',
  brand: 'Samsung',
  category: 'Mobiles',
  description:
  'Experience the next level with Samsung Galaxy A55. Powered by Exynos 1480, featuring a stunning 6.6-inch Super AMOLED 120Hz display, a 50MP triple camera, and a long-lasting 5000mAh battery.',
  images: [
  'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&q=80',
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80',
  'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600&q=80',
  'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Awesome Navy',
    storage: '128GB',
    price: 29999,
    mrp: 35999,
    stock: 15
  },
  {
    id: 'v2',
    color: 'Awesome Navy',
    storage: '256GB',
    price: 33999,
    mrp: 39999,
    stock: 8
  },
  {
    id: 'v3',
    color: 'Awesome Lilac',
    storage: '128GB',
    price: 29999,
    mrp: 35999,
    stock: 3
  }],

  specifications: [
  { key: 'Display', value: '6.6-inch Super AMOLED, 120Hz' },
  { key: 'Processor', value: 'Exynos 1480 Octa-core' },
  { key: 'RAM', value: '8GB' },
  { key: 'Battery', value: '5000mAh' },
  { key: 'Camera', value: '50MP + 12MP + 5MP' },
  { key: 'OS', value: 'Android 14' }],

  allow_cod: true,
  allow_online: true,
  rating: 4.3,
  review_count: 1247,
  is_active: true,
  created_at: '2024-01-15'
},
{
  id: '2',
  slug: 'iphone-15',
  name: 'Apple iPhone 15',
  brand: 'Apple',
  category: 'Mobiles',
  description:
  'iPhone 15 features a new 48MP camera system, the A16 Bionic chip, and a beautiful Super Retina XDR display. Built with aerospace-grade aluminum and color-infused glass.',
  images: [
  'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80',
  'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&q=80',
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Black',
    storage: '128GB',
    price: 79999,
    mrp: 89999,
    stock: 5
  },
  {
    id: 'v2',
    color: 'Black',
    storage: '256GB',
    price: 89999,
    mrp: 99999,
    stock: 2
  },
  {
    id: 'v3',
    color: 'Pink',
    storage: '128GB',
    price: 79999,
    mrp: 89999,
    stock: 7
  }],

  specifications: [
  { key: 'Display', value: '6.1-inch Super Retina XDR' },
  { key: 'Chip', value: 'Apple A16 Bionic' },
  { key: 'Camera', value: '48MP Main + 12MP Ultra Wide' },
  { key: 'Battery', value: 'Up to 20hr video playback' },
  { key: 'OS', value: 'iOS 17' }],

  allow_cod: false,
  allow_online: true,
  rating: 4.8,
  review_count: 3421,
  is_active: true,
  created_at: '2024-01-10'
},
{
  id: '3',
  slug: 'oneplus-nord-ce4',
  name: 'OnePlus Nord CE4',
  brand: 'OnePlus',
  category: 'Mobiles',
  description:
  'OnePlus Nord CE4 brings flagship-level speed with Snapdragon 7s Gen 2, a smooth 120Hz AMOLED display, and 100W SUPERVOOC charging for blazing-fast top-ups.',
  images: [
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80',
  'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Dark Chrome',
    storage: '128GB',
    price: 24999,
    mrp: 28999,
    stock: 20
  },
  {
    id: 'v2',
    color: 'Dark Chrome',
    storage: '256GB',
    price: 27999,
    mrp: 31999,
    stock: 12
  }],

  specifications: [
  { key: 'Display', value: '6.7-inch AMOLED, 120Hz' },
  { key: 'Processor', value: 'Snapdragon 7s Gen 2' },
  { key: 'RAM', value: '8GB' },
  { key: 'Battery', value: '5500mAh, 100W charging' }],

  allow_cod: true,
  allow_online: true,
  rating: 4.2,
  review_count: 892,
  is_active: true,
  created_at: '2024-02-01'
},
{
  id: '4',
  slug: 'realme-12-pro',
  name: 'Realme 12 Pro+',
  brand: 'Realme',
  category: 'Mobiles',
  description:
  'Realme 12 Pro+ packs a 50MP Sony IMX890 periscope telephoto camera with 3x optical zoom — bringing pro-grade photography to your pocket.',
  images: [
  'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600&q=80',
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Navigator Beige',
    storage: '128GB',
    price: 19999,
    mrp: 24999,
    stock: 25
  },
  {
    id: 'v2',
    color: 'Submarine Blue',
    storage: '256GB',
    price: 22999,
    mrp: 27999,
    stock: 10
  }],

  specifications: [
  { key: 'Display', value: '6.7-inch AMOLED, 120Hz' },
  { key: 'Camera', value: '50MP Sony IMX890 Periscope Tele' },
  { key: 'RAM', value: '8GB' },
  { key: 'Battery', value: '5000mAh, 67W charging' }],

  allow_cod: true,
  allow_online: true,
  rating: 4.1,
  review_count: 654,
  is_active: true,
  created_at: '2024-01-20'
},
{
  id: '5',
  slug: 'hp-laptop-15s',
  name: 'HP Laptop 15s',
  brand: 'HP',
  category: 'Laptops',
  description:
  'HP Laptop 15s with 12th Gen Intel Core i5, 16GB RAM, and a crisp 15.6-inch FHD IPS display — your reliable everyday workhorse for work, study and entertainment.',
  images: [
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
  'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Natural Silver',
    storage: '512GB SSD',
    price: 45999,
    mrp: 55999,
    stock: 8
  },
  {
    id: 'v2',
    color: 'Natural Silver',
    storage: '1TB SSD',
    price: 52999,
    mrp: 62999,
    stock: 4
  }],

  specifications: [
  { key: 'Processor', value: 'Intel Core i5-1235U' },
  { key: 'RAM', value: '16GB DDR4' },
  { key: 'Display', value: '15.6-inch FHD IPS' },
  { key: 'Graphics', value: 'Intel Iris Xe' },
  { key: 'OS', value: 'Windows 11 Home' }],

  allow_cod: false,
  allow_online: true,
  rating: 4.4,
  review_count: 521,
  is_active: true,
  created_at: '2024-01-05'
},
{
  id: '6',
  slug: 'boat-airdopes-141',
  name: 'boAt Airdopes 141',
  brand: 'boAt',
  category: 'Accessories',
  description:
  'boAt Airdopes 141 — 42 hours of total playback, ENx environmental noise cancellation, IPX4 water resistance, and Bluetooth 5.3 for ultra-stable connectivity.',
  images: [
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80',
  'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Active Black',
    storage: 'N/A',
    price: 999,
    mrp: 2999,
    stock: 50
  },
  {
    id: 'v2',
    color: 'Mint Green',
    storage: 'N/A',
    price: 999,
    mrp: 2999,
    stock: 30
  }],

  specifications: [
  { key: 'Driver Size', value: '8mm' },
  { key: 'Battery', value: '42hrs total playback' },
  { key: 'Connectivity', value: 'Bluetooth 5.3' },
  { key: 'Water Resistance', value: 'IPX4' }],

  allow_cod: true,
  allow_online: true,
  rating: 4.0,
  review_count: 8934,
  is_active: true,
  created_at: '2024-02-10'
},
{
  id: '7',
  slug: 'samsung-43-tv',
  name: 'Samsung 43" Crystal 4K TV',
  brand: 'Samsung',
  category: 'TVs',
  description:
  'Samsung Crystal 4K UHD Smart TV with HDR10+, Tizen OS, and the PurColor engine — bringing cinematic visuals and smart streaming to your living room.',
  images: [
  'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'Black',
    storage: '43 inch',
    price: 32999,
    mrp: 42999,
    stock: 6
  },
  {
    id: 'v2',
    color: 'Black',
    storage: '50 inch',
    price: 42999,
    mrp: 54999,
    stock: 3
  }],

  specifications: [
  { key: 'Resolution', value: '4K UHD (3840x2160)' },
  { key: 'HDR', value: 'HDR10+' },
  { key: 'Smart TV', value: 'Tizen OS' },
  { key: 'HDMI Ports', value: '3 x HDMI 2.0' }],

  allow_cod: false,
  allow_online: true,
  rating: 4.5,
  review_count: 312,
  is_active: true,
  created_at: '2024-01-25'
},
{
  id: '8',
  slug: 'mi-powerbank-20000',
  name: 'Mi Power Bank 20000mAh',
  brand: 'Mi',
  category: 'Accessories',
  description:
  'Mi 20000mAh Power Bank with 18W fast charging, dual USB-A and USB-C output, advanced 9-layer protection — the perfect travel companion.',
  images: [
  'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80'],

  variants: [
  {
    id: 'v1',
    color: 'White',
    storage: '20000mAh',
    price: 1299,
    mrp: 1999,
    stock: 40
  },
  {
    id: 'v2',
    color: 'Black',
    storage: '20000mAh',
    price: 1299,
    mrp: 1999,
    stock: 35
  }],

  specifications: [
  { key: 'Capacity', value: '20000mAh' },
  { key: 'Output', value: '18W Fast Charge' },
  { key: 'Ports', value: '2x USB-A + 1x USB-C' },
  { key: 'Weight', value: '440g' }],

  allow_cod: true,
  allow_online: true,
  rating: 4.3,
  review_count: 2108,
  is_active: true,
  created_at: '2024-02-05'
}];


export const getProductBySlug = (slug: string) =>
DUMMY_PRODUCTS.find((p) => p.slug === slug);

export const getProductById = (id: string) =>
DUMMY_PRODUCTS.find((p) => p.id === id);