"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getPublicSettings } from '../lib/api';
import siteData from '../data/siteData.json';

// Shown until the live settings arrive (and if the request fails).
const FALLBACK = {
  store: { ...siteData.brand, whatsapp: '', youtube: '' },
  home: {},
  shipping: { flat_fee: 0, free_shipping_threshold: 0, estimated_delivery: '5-7 business days' },
  payments: { upi: false, cod: false, cod_fee: 0 },
};

const SettingsContext = createContext({ settings: FALLBACK, loaded: false });

export function SettingsProvider({ children, initial = null }) {
  const [settings, setSettings] = useState(initial || FALLBACK);
  const [loaded, setLoaded] = useState(!!initial);

  useEffect(() => {
    let cancelled = false;
    getPublicSettings()
      .then((s) => {
        if (!cancelled && s) setSettings(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SettingsContext.Provider value={{ settings, loaded }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
