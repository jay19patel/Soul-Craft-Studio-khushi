"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getMe, login as apiLogin, register as apiRegister, googleLogin as apiGoogleLogin, logout as apiLogout } from '../lib/api';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  
  // Use router carefully in app router
  let router;
  try {
    router = useRouter();
  } catch (e) {
    // Handling case where AuthContext might be used where useRouter is unavailable
  }

  const loadingRef = useRef(false);

  const loadUser = useCallback(async () => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const userData = await getMe();
      setUser(userData);
      localStorage.setItem('user_data', JSON.stringify(userData));
      console.log('User loaded successfully:', userData);
    } catch (error) {
      const isAuthError =
        error.status === 401 ||
        (error.response && error.response.status === 401) ||
        error.message.includes('401') ||
        error.message.toLowerCase().includes('token not valid') ||
        error.message.toLowerCase().includes('credentials') ||
        error.message.toLowerCase().includes('given token not valid') ||
        error.message.includes('API error 401');

      if (isAuthError) {
        console.warn('Authentication session expired or invalid. Clearing session.');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        setToken(null);
        setUser(null);
      } else {
        console.error('Failed to load user:', error);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    console.log('AuthContext mounted, token:', storedToken ? 'exists' : 'none');

    if (storedToken) {
      setToken(storedToken);
      loadUser();
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  const loginWithGoogle = async (code) => {
    try {
      const response = await apiGoogleLogin(code);
      const accessToken = response.access_token || response.key || response.access;

      if (!accessToken) {
        throw new Error('Failed to get access token from Google login');
      }

      localStorage.setItem('auth_token', accessToken);
      setToken(accessToken);

      await loadUser();

      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    }
  };

  const login = async (email, password) => {
    try {
      const response = await apiLogin(email, password);
      const accessToken = response.access_token || response.key || response.access;
      
      if (!accessToken) {
        throw new Error('No access token received from login');
      }

      localStorage.setItem('auth_token', accessToken);
      setToken(accessToken);
      console.log('Token stored:', accessToken);

      await loadUser();

      return { success: true };
    } catch (error) {
      setError(error.message || 'Login failed');
      return { success: false, error: error.message };
    }
  };

  const register = async (data) => {
    try {
      const registerPayload = {
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      };

      await apiRegister(registerPayload);

      console.log('Auto login after registration');
      const loginResult = await login(data.email, data.password);

      return loginResult;
    } catch (error) {
      let errorMessage = error.message || "Registration failed";
      if (error.response && error.response.data) {
        const errors = error.response.data;
        errorMessage = "";
        Object.keys(errors).forEach(key => {
          const messages = Array.isArray(errors[key]) ? errors[key].join(" ") : errors[key];
          errorMessage += `${key}: ${messages}\n`;
        });
        errorMessage = errorMessage.trim();
      }
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setToken(null);
      setUser(null);
      if (router) {
         router.push('/');
      } else {
         window.location.href = '/';
      }
      console.log('Logged out');
    }
  };

  const setAuthFromToken = useCallback(async (accessToken) => {
    if (loadingRef.current) {
      console.log('Already loading, skipping setAuthFromToken');
      return;
    }

    localStorage.setItem('auth_token', accessToken);
    setToken(accessToken);

    await loadUser();
  }, [loadUser]);

  const updateProfile = async () => {
    try {
      await loadUser();
    } catch (error) {
      console.error('Failed to reload user after update:', error);
    }
  };

  // Keep googleLogin mapped to loginWithGoogle for backwards compatibility with any existing code calling googleLogin
  const value = {
    user,
    token,
    loading,
    error,
    login,
    loginWithGoogle,
    googleLogin: loginWithGoogle,
    register,
    logout,
    setAuthFromToken,
    updateProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
