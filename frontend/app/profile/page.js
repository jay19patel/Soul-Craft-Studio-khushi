"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { User, Lock, Save, AlertCircle, CheckCircle2, MapPin, Phone, Plus, Star, LayoutDashboard } from 'lucide-react';
import { getAddresses, addAddress, setDefaultAddress, getContacts, addContact, setDefaultContact } from '../../lib/api';

export default function ProfilePage() {
  const { user, isAuthenticated, updateUserProfile } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('profile'); // profile, addresses, contacts

  const [formData, setFormData] = useState({
    full_name: '',
    password: '',
    confirm_password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Address State
  const [addresses, setAddresses] = useState([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({ full_name: '', address_line: '', city: '', state: '', pincode: '', is_default: false });

  // Contact State
  const [contacts, setContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ phone_number: '', is_default: false });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        full_name: user.full_name || user.name || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
      fetchContacts();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') router.push('/login');
    return null;
  }

  // --- Profile Logic ---
  const handleProfileChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password && formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const payload = { full_name: formData.full_name };
    if (formData.password) {
      payload.password = formData.password;
    }

    const result = await updateUserProfile(payload);
    setLoading(false);

    if (result.success) {
      setSuccess('Profile updated successfully!');
      setFormData((prev) => ({ ...prev, password: '', confirm_password: '' }));
    } else {
      setError(result.error || 'Failed to update profile');
    }
  };

  // --- Address Logic ---
  const fetchAddresses = async () => {
    try {
      const data = await getAddresses();
      setAddresses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    try {
      await addAddress(addressForm);
      setAddressForm({ full_name: '', address_line: '', city: '', state: '', pincode: '', is_default: false });
      setShowAddAddress(false);
      fetchAddresses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetDefaultAddress = async (id) => {
    try {
      await setDefaultAddress(id);
      fetchAddresses();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Contact Logic ---
  const fetchContacts = async () => {
    try {
      const data = await getContacts();
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    try {
      await addContact(contactForm);
      setContactForm({ phone_number: '', is_default: false });
      setShowAddContact(false);
      fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetDefaultContact = async (id) => {
    try {
      await setDefaultContact(id);
      fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-12 md:py-20 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button onClick={() => setActiveTab('profile')} className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-slate-100 text-slate-600'}`}>
            <User className="w-5 h-5" />
            <span className="font-bold text-sm uppercase tracking-wider">Profile</span>
          </button>
          <button onClick={() => setActiveTab('addresses')} className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'addresses' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-slate-100 text-slate-600'}`}>
            <MapPin className="w-5 h-5" />
            <span className="font-bold text-sm uppercase tracking-wider">Addresses</span>
          </button>
          <button onClick={() => setActiveTab('contacts')} className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'contacts' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-slate-100 text-slate-600'}`}>
            <Phone className="w-5 h-5" />
            <span className="font-bold text-sm uppercase tracking-wider">Contacts</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                Profile Settings
              </h2>
              {error && <div className="text-red-500">{error}</div>}
              {success && <div className="text-green-500">{success}</div>}

              <form onSubmit={handleProfileSubmit} className="flex flex-col gap-5 max-w-md">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Email Address</label>
                  <input disabled value={user?.email || ''} className="w-full bg-slate-100 text-slate-500 border-none rounded-2xl py-4 px-4 text-sm cursor-not-allowed" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Full Name</label>
                  <input name="full_name" required value={formData.full_name} onChange={handleProfileChange} className="w-full bg-slate-50 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">New Password</label>
                  <input name="password" type="password" value={formData.password} onChange={handleProfileChange} placeholder="Leave blank to keep current" className="w-full bg-slate-50 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                {formData.password && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Confirm New Password</label>
                    <input name="confirm_password" type="password" value={formData.confirm_password} onChange={handleProfileChange} className="w-full bg-slate-50 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* ADDRESSES TAB */}
          {activeTab === 'addresses' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Saved Addresses</h2>
                <button onClick={() => setShowAddAddress(!showAddAddress)} className="bg-orange-500 text-white p-2 rounded-full hover:bg-orange-600 transition-all">
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {showAddAddress && (
                <form onSubmit={handleAddressSubmit} className="bg-slate-50 p-6 rounded-3xl flex flex-col gap-4">
                  <input placeholder="Full Name" required value={addressForm.full_name} onChange={(e) => setAddressForm({...addressForm, full_name: e.target.value})} className="w-full bg-white rounded-xl py-3 px-4 text-sm" />
                  <textarea placeholder="Address Line" required value={addressForm.address_line} onChange={(e) => setAddressForm({...addressForm, address_line: e.target.value})} className="w-full bg-white rounded-xl py-3 px-4 text-sm" rows={2} />
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="City" required value={addressForm.city} onChange={(e) => setAddressForm({...addressForm, city: e.target.value})} className="w-full bg-white rounded-xl py-3 px-4 text-sm" />
                    <input placeholder="State" required value={addressForm.state} onChange={(e) => setAddressForm({...addressForm, state: e.target.value})} className="w-full bg-white rounded-xl py-3 px-4 text-sm" />
                  </div>
                  <input placeholder="Pincode" required value={addressForm.pincode} onChange={(e) => setAddressForm({...addressForm, pincode: e.target.value})} className="w-full bg-white rounded-xl py-3 px-4 text-sm" />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({...addressForm, is_default: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
                    Set as default address
                  </label>
                  <button type="submit" className="bg-blue-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-blue-700">Save Address</button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.length === 0 && !showAddAddress && <p className="text-slate-500 text-sm">No saved addresses.</p>}
                {addresses.map(addr => (
                  <div key={addr.id} className={`p-5 rounded-2xl border-2 ${addr.is_default ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-blue-950">{addr.full_name}</span>
                      {addr.is_default ? (
                        <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase">Default</span>
                      ) : (
                        <button onClick={() => handleSetDefaultAddress(addr.id)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase">Set Default</button>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{addr.address_line}</p>
                    <p className="text-sm text-slate-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTACTS TAB */}
          {activeTab === 'contacts' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Saved Contacts</h2>
                <button onClick={() => setShowAddContact(!showAddContact)} className="bg-orange-500 text-white p-2 rounded-full hover:bg-orange-600 transition-all">
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {showAddContact && (
                <form onSubmit={handleContactSubmit} className="bg-slate-50 p-6 rounded-3xl flex flex-col gap-4">
                  <input placeholder="Phone Number" required value={contactForm.phone_number} onChange={(e) => setContactForm({...contactForm, phone_number: e.target.value})} className="w-full bg-white rounded-xl py-3 px-4 text-sm" />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={contactForm.is_default} onChange={(e) => setContactForm({...contactForm, is_default: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
                    Set as default contact
                  </label>
                  <button type="submit" className="bg-blue-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-blue-700">Save Contact</button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.length === 0 && !showAddContact && <p className="text-slate-500 text-sm">No saved contacts.</p>}
                {contacts.map(contact => (
                  <div key={contact.id} className={`p-5 rounded-2xl border-2 flex justify-between items-center ${contact.is_default ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                    <span className="font-bold text-blue-950">{contact.phone_number}</span>
                    {contact.is_default ? (
                      <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase">Default</span>
                    ) : (
                      <button onClick={() => handleSetDefaultContact(contact.id)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase">Set Default</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
