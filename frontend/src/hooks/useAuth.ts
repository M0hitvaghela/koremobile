import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const adminLogin = useAuthStore((state) => state.adminLogin);
  const logout = useAuthStore((state) => state.logout);
  const register = useAuthStore((state) => state.register);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const addAddress = useAuthStore((state) => state.addAddress);
  const updateAddress = useAuthStore((state) => state.updateAddress);
  const deleteAddress = useAuthStore((state) => state.deleteAddress);
  const setDefaultAddress = useAuthStore((state) => state.setDefaultAddress);
  const hydrate = useAuthStore((state) => state.hydrate);

  return {
    user,
    isAuthenticated,
    login,
    adminLogin,
    logout,
    register,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    hydrate
  };
}
