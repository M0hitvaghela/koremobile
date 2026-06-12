import { Order } from '../types/order';

export const DUMMY_ORDERS: Order[] = [
{
  id: 'ord1',
  order_number: 'KM-2024-0142',
  user_id: 'u1',
  items: [
  {
    product_id: '1',
    variant_id: 'v1',
    name: 'Samsung Galaxy A55 5G',
    image:
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80',
    color: 'Awesome Navy',
    storage: '128GB',
    price: 29999,
    mrp: 35999,
    qty: 1
  }],

  address: {
    name: 'Raj Patel',
    phone: '9876543210',
    house_no: 'B-12',
    area: 'Satellite',
    village: 'Ahmedabad',
    taluka: 'Daskroi',
    district: 'Ahmedabad',
    pincode: '380015',
    state: 'Gujarat',
    label: 'Home',
    is_default: true
  },
  subtotal: 29999,
  shipping_fee: 0,
  total: 29999,
  payment_method: 'online',
  payment_status: 'paid',
  status: 'shipped',
  tracking_number: 'DTDC9876543',
  created_at: '2024-02-10'
},
{
  id: 'ord2',
  order_number: 'KM-2024-0138',
  user_id: 'u1',
  items: [
  {
    product_id: '6',
    variant_id: 'v1',
    name: 'boAt Airdopes 141',
    image:
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
    color: 'Active Black',
    storage: 'N/A',
    price: 999,
    mrp: 2999,
    qty: 2
  }],

  address: {
    name: 'Raj Patel',
    phone: '9876543210',
    house_no: 'B-12',
    area: 'Satellite',
    village: 'Ahmedabad',
    taluka: 'Daskroi',
    district: 'Ahmedabad',
    pincode: '380015',
    state: 'Gujarat',
    label: 'Home',
    is_default: true
  },
  subtotal: 1998,
  shipping_fee: 50,
  total: 2048,
  payment_method: 'cod',
  payment_status: 'pending',
  status: 'processing',
  created_at: '2024-02-12'
},
{
  id: 'ord3',
  order_number: 'KM-2024-0130',
  user_id: 'u1',
  items: [
  {
    product_id: '5',
    variant_id: 'v1',
    name: 'HP Laptop 15s',
    image:
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
    color: 'Natural Silver',
    storage: '512GB SSD',
    price: 45999,
    mrp: 55999,
    qty: 1
  }],

  address: {
    name: 'Raj Patel',
    phone: '9876543210',
    house_no: 'B-12',
    area: 'Satellite',
    village: 'Ahmedabad',
    taluka: 'Daskroi',
    district: 'Ahmedabad',
    pincode: '380015',
    state: 'Gujarat',
    label: 'Home',
    is_default: true
  },
  subtotal: 45999,
  shipping_fee: 0,
  total: 45999,
  payment_method: 'online',
  payment_status: 'paid',
  status: 'delivered',
  tracking_number: 'BLUEDART1234567',
  created_at: '2024-01-28'
}];