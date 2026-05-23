'use client';

import React, { useState } from 'react';
import { submitContactMessage } from '../lib/api';

const ContactForm = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: 'General Inquiry',
        message: ''
    });
    const [status, setStatus] = useState('idle'); // idle, loading, success, error

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        try {
            await submitContactMessage(formData);
            setStatus('success');
            setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
        } catch (error) {
            console.error('Failed to submit message:', error);
            setStatus('error');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-xl bg-white p-8 md:p-10 rounded-[40px] shadow-xl shadow-orange-100 border border-orange-50 relative overflow-hidden">
            
            {status === 'success' && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center rounded-[40px]">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Message Sent!</h3>
                    <p className="text-slate-500 font-medium">Thank you for reaching out. We will get back to you within 24-48 hours.</p>
                    <button type="button" onClick={() => setStatus('idle')} className="mt-6 px-6 py-2 bg-orange-100 text-orange-600 font-bold rounded-full hover:bg-orange-200 transition-colors">
                        Send another message
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="text-sm font-bold text-blue-950 uppercase tracking-widest px-2">Your Name</label>
                    <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Khusi Patel"
                        className="px-6 py-4 rounded-3xl bg-slate-50 border border-slate-100 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                        required
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-sm font-bold text-blue-950 uppercase tracking-widest px-2">Email Address</label>
                    <input
                        type="email"
                        id="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Khushipatelpatel112@gmail.com"
                        className="px-6 py-4 rounded-3xl bg-slate-50 border border-slate-100 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                        required
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="subject" className="text-sm font-bold text-blue-950 uppercase tracking-widest px-2">Subject</label>
                <select
                    id="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="px-6 py-4 rounded-3xl bg-slate-50 border border-slate-100 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-medium appearance-none"
                >
                    <option>General Inquiry</option>
                    <option>Custom Order Request</option>
                    <option>Collaboration</option>
                    <option>Workshop Booking</option>
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-sm font-bold text-blue-950 uppercase tracking-widest px-2">Your Message</label>
                <textarea
                    id="message"
                    rows="5"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us about your project or inquiry..."
                    className="px-6 py-4 rounded-3xl bg-slate-50 border border-slate-100 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-medium resize-none"
                    required
                ></textarea>
            </div>

            {status === 'error' && (
                <p className="text-red-500 text-sm font-medium px-2">Something went wrong. Please try again.</p>
            )}

            <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-4 px-10 py-5 bg-orange-500 text-white font-black uppercase tracking-widest rounded-full hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-orange-200 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
            >
                {status === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
        </form>
    );
};

export default ContactForm;
