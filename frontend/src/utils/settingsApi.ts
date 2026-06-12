import { api } from './api';

export interface PublicSettingsPayload {
  freeShippingThreshold: number;
  flatShippingFee: number;
  enableFreeShipping: boolean;
  defaultCodEnabled: boolean;
  defaultOnlineEnabled: boolean;
  gstRate: number;
}

export const settingsApi = {
  get: async (): Promise<PublicSettingsPayload> => {
    const res = await api.get<PublicSettingsPayload>('/settings');
    return res.data;
  },
};