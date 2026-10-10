import React from 'react';
import { Clapperboard } from 'lucide-react';
import YouTubeEmbed from './YouTubeEmbed';

/** "Behind the craft" — store-level YouTube videos set in Admin → Homepage. */
export default function BrandVideos({ title, subtitle, videos = [] }) {
  if (!videos.length) return null;
  const shorts = videos.filter((v) => v.is_short);
  const wide = videos.filter((v) => !v.is_short);

  return (
    <section className="w-full bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col gap-10">
        <div className="text-center flex flex-col items-center gap-3">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 font-bold text-sm">
            <Clapperboard className="w-4 h-4" /> Videos
          </span>
          <h2 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">{title || 'Behind the craft'}</h2>
          {subtitle && <p className="text-slate-500 max-w-xl text-base md:text-lg">{subtitle}</p>}
        </div>

        {wide.length > 0 && (
          <div className={`grid gap-5 md:gap-8 ${wide.length === 1 ? 'grid-cols-1 max-w-4xl mx-auto w-full' : 'grid-cols-1 md:grid-cols-2'}`}>
            {wide.map((v) => (
              <YouTubeEmbed key={v.id} videoId={v.youtube_id} title={v.title} />
            ))}
          </div>
        )}

        {shorts.length > 0 && (
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center">
            {shorts.map((v) => (
              <div key={v.id} className="w-[62%] sm:w-[40%] md:w-[240px] shrink-0 snap-center">
                <YouTubeEmbed videoId={v.youtube_id} title={v.title} vertical />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
