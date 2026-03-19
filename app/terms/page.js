import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function TermsPage() {
    const policies = [
        {
            title: "1. No Cash on Delivery (COD)",
            desc: "All orders must be pre-paid. We currently do not offer Cash on Delivery services to ensure a streamlined and secure crafting process."
        },
        {
            title: "2. No Returns or Refunds",
            desc: "Since every item is meticulously handcrafted specifically for you, all sales are final. We do not accept returns, exchanges, or process refunds."
        },
        {
            title: "3. Order Processing & Shipping",
            desc: "Custom and standard orders typically take 10-14 days to craft and dispatch. Shipping times vary based on location. We are not responsible for delays caused by courier services."
        },
        {
            title: "4. Custom Orders",
            desc: "For bespoke items, clear communication regarding design, color, and materials is required upfront. Once crafting has begun, no modifications to the design can be made."
        },
        {
            title: "5. Privacy Policy",
            desc: "Your personal information, including contact details and shipping addresses, is strictly used for order fulfillment and communication. We do not share your data with third parties."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
            <Navbar />

            <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-16 md:py-24 flex flex-col gap-12">
                <section className="text-center flex flex-col items-center gap-6">
                    <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Soul Craft Studio</span>
                    <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                        Store <span className="text-blue-600">Policies.</span>
                    </h1>
                    <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl">
                        Please review our store policies, terms of service, and privacy guidelines before placing an order. By making a purchase, you agree to these terms.
                    </p>
                </section>

                <section className="bg-white p-8 md:p-12 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-10">
                    {policies.map((policy, idx) => (
                        <div key={idx} className="flex flex-col gap-3">
                            <h3 className="text-xl font-[family-name:var(--font-climate-crisis)] uppercase text-orange-500 tracking-wide">
                                {policy.title}
                            </h3>
                            <p className="text-slate-600 font-medium leading-relaxed">
                                {policy.desc}
                            </p>
                        </div>
                    ))}

                    <div className="pt-8 border-t border-slate-100 flex flex-col gap-4 text-center mt-4">
                        <p className="text-slate-500 text-sm font-bold">
                            If you have any questions or concerns, please get in touch with us via our <a href="/contact" className="text-blue-600 hover:text-orange-500 transition-colors">Contact Page</a>.
                        </p>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
