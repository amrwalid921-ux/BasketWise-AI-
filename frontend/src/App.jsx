import React, { useEffect, useState } from 'react';
import GameView from './ui/GameView.jsx';
import AboutPage from './pages/AboutPage.jsx';
import { api } from './api.js';
import { loadAssets } from './engine/assets.js';
import { Gamepad2, Info } from 'lucide-react';

export default function App() {
  const [page, setPage] = useState('game');
  const [boot, setBoot] = useState({ store: null, assets: null, progress: 0, error: '' });

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const fonts = Promise.race([document.fonts.load('800 16px Cairo'), new Promise((r) => setTimeout(r, 1200))]).catch(() => {});
        const [store, assets] = await Promise.all([
          api.store(),
          loadAssets((p) => !dead && setBoot((b) => ({ ...b, progress: p }))),
          fonts,
        ]).then(([st, as]) => [st, as]);
        if (!dead) setBoot({ store, assets, progress: 1, error: '' });
      } catch (e) {
        if (!dead) setBoot((b) => ({ ...b, error: String(e.message || e) }));
      }
    })();
    return () => { dead = true; };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><img className="brand-logo" src="/basketwise-ai-logo.png" alt="BasketWise AI — قرارات شراء ذكية في حدود ميزانيتك" /></div>
        <nav>
          {[["game", "اللعبة", Gamepad2], ["about", "عن المشروع", Info]].map(([k, l, Icon]) => (
            <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}><Icon size={19} strokeWidth={2.2} aria-hidden="true" />{l}</button>
          ))}
        </nav>
        <span className="chrome-deco" aria-hidden="true"><i /><i /><i /></span>
      </header>
      <main>
        {boot.error ? (
          <div className="page"><div className="note warn big">
            <b>مقدرتش أوصل للـ backend.</b><br />{boot.error}<br />
            شغّل المشروع بالأمر: <code>npm start</code> (من فولدر المشروع)، أو شغّل السيرفر لوحده: <code>cd backend &amp;&amp; make run</code>.
          </div></div>
        ) : !boot.assets ? (
          <div className="loading"><div className="spinner" /><p>بنجهّز المتجر… {Math.round(boot.progress * 100)}%</p></div>
        ) : (
          <>
            <div style={{ display: page === 'game' ? 'block' : 'none', height: '100%' }}><GameView store={boot.store} assets={boot.assets} active={page === 'game'} /></div>
            {page === 'about' && <AboutPage />}
          </>
        )}
      </main>
    </div>
  );
}
