'use client';

import React from 'react';

const ContactForm = () => {
    return (
        <form className="flex flex-col gap-6 w-full max-w-xl bg-white p-8 md:p-10 rounded-[40px] shadow-xl shadow-orange-100 border border-orange-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="text-sm font-bold text-blue-950 uppercase tracking-widest px-2">Your Name</label>
                    <input
                        type="text"
                        id="name"
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
                    placeholder="Tell us about your project or inquiry..."
                    className="px-6 py-4 rounded-3xl bg-slate-50 border border-slate-100 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-medium resize-none"
                    required
                ></textarea>
            </div>

            <button
                type="submit"
                className="mt-4 px-10 py-5 bg-orange-500 text-white font-black uppercase tracking-widest rounded-full hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-orange-200 transition-all duration-300"
            >
                Send Message
            </button>
        </form>
    );
};

export default ContactForm;
