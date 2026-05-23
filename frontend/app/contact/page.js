import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ContactForm from '../../components/ContactForm';
import siteData from '../../data/siteData.json';

export default function ContactPage() {
    const { brand } = siteData;

    const requirements = [
        { title: "Project Inspiration", desc: "Attach images or links to designs you love so we can understand your style." },
        { title: "Dimensions", desc: "Specify the approximate width, height, or diameter you'd like for your custom piece." },
        { title: "Timeline", desc: "When do you need it? Most custom orders take 10-14 days to craft and deliver." }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
            <Navbar />

            <main className="flex-grow w-full max-w-6xl mx-auto px-4 py-16 md:py-24 flex flex-col items-center gap-24">

                {/* Header Section */}
                <section className="text-center flex flex-col items-center gap-6 max-w-2xl">
                    <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Get in Touch</span>
                    <h1 className="text-5xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                        Let's create something <br /> <span className="text-orange-500">Together.</span>
                    </h1>
                    <p className="text-lg text-slate-500 font-medium leading-relaxed">
                        Have a question, a custom request, or just want to say hello? Use the form below, and we'll get back to you within 24-48 hours.
                    </p>
                </section>

                {/* Form and Requirements Grid */}
                <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

                    {/* Left: Contact Form */}
                    <div className="flex flex-col gap-8 order-2 lg:order-1">
                        <h3 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 tracking-wide">
                            Send a Message
                        </h3>
                        <ContactForm />
                    </div>

                    {/* Right: Requirements */}
                    <div className="flex flex-col gap-10 order-1 lg:order-2 bg-blue-50/50 p-8 md:p-12 rounded-[50px] border border-blue-100">
                        <div className="flex flex-col gap-4">
                            <h3 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 tracking-wide">
                                Custom Order <br /> <span className="text-blue-600 italic">Requirements.</span>
                            </h3>
                            <p className="text-slate-500 font-medium leading-relaxed">
                                For custom handcrafted requests, please include the following details in your message to help us provide an accurate quote:
                            </p>
                        </div>

                        <div className="flex flex-col gap-8">
                            {requirements.map((req, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center font-black text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h5 className="font-black text-blue-950 uppercase text-xs tracking-widest">{req.title}</h5>
                                        <p className="text-slate-500 text-sm font-medium leading-relaxed">{req.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-8 border-t border-blue-200/50 flex flex-col gap-4">
                            <h4 className="text-blue-900 font-black uppercase text-xs tracking-widest">Get In Touch</h4>
                            <div className="flex flex-col gap-2">
                                <a href={`mailto:${brand.email}`} className="text-slate-600 font-bold hover:text-orange-500 transition-colors">{brand.email}</a>
                                {brand.phone && (
                                    <a href={`tel:${brand.phone.replace(/\s+/g, '')}`} className="text-slate-600 font-bold hover:text-orange-500 transition-colors">{brand.phone}</a>
                                )}
                            </div>
                            <p className="text-slate-500 text-sm font-medium italic mt-2">Based in {brand.location}</p>
                        </div>
                    </div>
                </section>

            </main>

            <Footer />
        </div >
    );
}
