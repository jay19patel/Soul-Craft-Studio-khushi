import React from 'react';
import siteData from '../data/siteData.json';

const Hero = () => {
    const { brand } = siteData;
    const nameParts = brand.name.split(' ');
    const lastName = nameParts.pop();
    const firstNames = nameParts.join(' ');

    return (
        <section className="text-center flex flex-col items-center gap-8 max-w-4xl py-12 md:py-20">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-[1.1]">
                {firstNames} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400 block mt-2">
                    {lastName}
                </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl font-medium leading-relaxed mt-4">
                {brand.tagline}
            </p>
        </section>
    );
};

export default Hero;
