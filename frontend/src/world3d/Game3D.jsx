import React, { useEffect, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Scene3D } from './Scene3D.js';

// Hosts the Three.js scene on top of the 2D canvas. Pure view: reads the Game, never writes to it.
export default function Game3D({ game, store, assets, mode }) {
  const host = useRef(null);
  const scene = useRef(null);
  useEffect(() => {
    if (!host.current || !game) return undefined;
    let cancelled = false; let s = null;
    // real product photos (assets/products-photo/*.png); items without a photo fall back to the SVG art
    const load = (slug) => new Promise((res) => { const im = new Image(); im.onload = () => res([slug, im]); im.onerror = () => res(null); im.src = `/assets/products-photo/${slug}.png`; });
    const loadPerson = (i) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `/assets/people/p${i}.png`; });
    const loadWalker = () => new Promise((res) => new GLTFLoader().load('/assets/models/CesiumMan.glb', (gl) => res({ scene: gl.scene, anim: gl.animations[0] }), undefined, () => res(null)));
    const loadTex = (k) => new Promise((res) => { const im = new Image(); im.onload = () => res([k, im]); im.onerror = () => res(null); im.src = `/assets/textures/${k}.jpg`; });
    Promise.all([Promise.all(store.products.map((p) => load(p.slug))), Promise.all(['floor', 'ceiling'].map(loadTex)), Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9].map(loadPerson)), loadWalker()]).then(([list, tl, pl, walker]) => {
      const people = pl.filter(Boolean);
      const textures = Object.fromEntries(tl.filter(Boolean));
      if (cancelled) return;
      const photos = new Map(list.filter(Boolean));
      s = new Scene3D(host.current, game, store, assets, { mode, photos, textures, people, walker });
      scene.current = s;
    });
    return () => { cancelled = true; if (s) { s.destroy(); } scene.current = null; };
  }, [game, store, assets]);
  useEffect(() => { scene.current && scene.current.setMode(mode); }, [mode]);
  return <div className="view3d" ref={host} />;
}
