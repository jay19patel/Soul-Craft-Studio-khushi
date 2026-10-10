"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
} from '../lib/api';

const AuthContext = createContext();

/**
 * The session lives only in an httpOnly cookie set by the server — it is
 * never readable from JavaScript, so an XSS bug can't steal it. We just ask
 * the server "who am I?" on load.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me || null);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clean up tokens stored by older versions of the site.
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
    } catch {}
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    setError(null);
    try {
      const { user: loggedIn } = await apiLogin(email, password);
      setUser(loggedIn);
      return { success: true, user: loggedIn };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const register = async (data) => {
    setError(null);
    try {
      const { user: created } = await apiRegister({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      });
      setUser(created);
      return { success: true, user: created };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      router.push('/');
      router.refresh();
    }
  };

  const updateUserProfile = async (data) => {
    try {
      const updated = await apiUpdateProfile(data);
      setUser((prev) => ({ ...(prev || {}), ...updated }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser,
    updateUserProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
