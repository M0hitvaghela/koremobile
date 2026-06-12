import { Address } from './order';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  addresses: Address[];
  gstin?: string;
  company_name?: string;
}