import { Review } from '../types/product';

export const DUMMY_REVIEWS: Review[] = [
{
  id: 'r1',
  product_id: '1',
  user_name: 'Arjun Sharma',
  rating: 5,
  title: 'Excellent phone for the price!',
  body: 'Camera quality is outstanding. Battery lasts full day easily. Super smooth performance.',
  date: '2024-02-08',
  verified_purchase: true
},
{
  id: 'r2',
  product_id: '1',
  user_name: 'Priya Mehta',
  rating: 4,
  title: 'Good phone, minor heating issue',
  body: 'Overall great experience. Slight heating during gaming but normal usage is perfectly fine.',
  date: '2024-01-30',
  verified_purchase: true
},
{
  id: 'r3',
  product_id: '1',
  user_name: 'Karan Patel',
  rating: 4,
  title: 'Value for money',
  body: 'Fast delivery from Koremobile. Product is sealed and genuine. Happy with purchase.',
  date: '2024-01-22',
  verified_purchase: true
},
{
  id: 'r4',
  product_id: '2',
  user_name: 'Neha Desai',
  rating: 5,
  title: 'Worth every rupee',
  body: 'iPhone 15 camera is a beast. Build quality feels premium. Highly recommended.',
  date: '2024-02-05',
  verified_purchase: true
},
{
  id: 'r5',
  product_id: '5',
  user_name: 'Vivek Joshi',
  rating: 5,
  title: 'Perfect work laptop',
  body: 'Fast, light, great display. Handles all my office work effortlessly.',
  date: '2024-01-29',
  verified_purchase: true
},
{
  id: 'r6',
  product_id: '6',
  user_name: 'Aditi Shah',
  rating: 4,
  title: 'Great earbuds at this price',
  body: 'Sound is punchy, battery life is excellent. Mic quality could be a tad better.',
  date: '2024-02-09',
  verified_purchase: true
}];


export const getReviewsByProduct = (productId: string) =>
DUMMY_REVIEWS.filter((r) => r.product_id === productId);