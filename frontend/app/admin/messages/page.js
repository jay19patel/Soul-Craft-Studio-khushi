"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { getAdminMessages, updateAdminMessage, deleteAdminMessage } from '../../../lib/api';
import { Mail, Search, Trash2, CheckCircle, Circle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminMessagesPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.is_superuser) {
      fetchMessages();
    } else if (isAuthenticated && !user?.is_superuser) {
      router.push('/profile');
    }
  }, [isAuthenticated, user, router]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await getAdminMessages();
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleReadStatus = async (message) => {
    if (togglingId) return;
    setTogglingId(message.id);
    try {
      await updateAdminMessage(message.id, { is_read: !message.is_read });
      setMessages(messages.map(m => m.id === message.id ? { ...m, is_read: !m.is_read } : m));
    } catch (err) {
      alert('Error updating status: ' + err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (deletingId) return;
    if (window.confirm("Are you sure you want to delete this message?")) {
      setDeletingId(id);
      try {
        await deleteAdminMessage(id);
        setMessages(messages.filter(m => m.id !== id));
      } catch (err) {
        alert('Error deleting message: ' + err.message);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredMessages = messages.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-100">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        
        <div className="flex flex-col gap-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex flex-col gap-4">
              <Link href="/admin/dashboard" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors w-fit">
                <ChevronLeft className="w-4 h-4" /> Dashboard
              </Link>
              <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-indigo-950">
                Messages.
              </h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                Manage contact form submissions
              </p>
            </div>
          </div>

          {/* List Section */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-10 flex flex-col gap-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
                Inbox <span className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full">{messages.length}</span>
              </h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-50">
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4 w-12">Status</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sender Info</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Subject / Message</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500 text-sm font-medium">No messages found.</td>
                    </tr>
                  ) : filteredMessages.map((msg) => (
                    <tr key={msg.id} className={`hover:bg-slate-50/50 transition-colors group ${!msg.is_read ? 'bg-indigo-50/20' : ''}`}>
                      <td className="py-4 pl-4 align-top">
                        <button
                          onClick={() => toggleReadStatus(msg)}
                          disabled={togglingId === msg.id}
                          className="mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={msg.is_read ? "Mark as unread" : "Mark as read"}
                        >
                          {msg.is_read ? (
                            <CheckCircle className="w-5 h-5 text-slate-300 hover:text-indigo-400 transition-colors" />
                          ) : (
                            <Circle className="w-5 h-5 text-indigo-500 hover:text-indigo-600 transition-colors fill-indigo-100" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm ${!msg.is_read ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{msg.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 tracking-widest">{msg.email}</span>
                          <span className="text-[10px] font-bold text-indigo-400 mt-2 uppercase tracking-widest">
                            {new Date(msg.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 align-top max-w-sm">
                        <div className="flex flex-col gap-1 pr-6">
                          <span className={`text-sm ${!msg.is_read ? 'font-black text-indigo-900' : 'font-bold text-slate-700'}`}>{msg.subject}</span>
                          <p className="text-xs text-slate-500 font-medium whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </td>
                      <td className="py-4 pr-4 align-top text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                          <button
                            onClick={() => handleDelete(msg.id)}
                            disabled={deletingId === msg.id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
