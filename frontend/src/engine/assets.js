// Loads the SVG art from /assets and rasterises it once into canvases so that the
// per-frame drawImage() calls are cheap (SVG images would be re-rasterised on every zoom change).

const loadImg = (src) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('failed to load ' + src));
    im.src = src;
  });

function raster(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c;
}

export async function loadAssets(onProgress) {
  const manifest = await (await fetch('/assets/manifest.json')).json();
  const meta = await (await fetch('/assets/shopper/meta.json')).json();
  const jobs = [];
  const out = { products: {}, props: {}, propImg: {}, shopper: {}, meta, manifest };
  let done = 0;
  const total = manifest.products.length + Object.keys(manifest.props).length + 16;
  const tick = () => onProgress && onProgress(++done / total);

  for (const slug of manifest.products) {
    // real product photo first (contained in a square, keeps aspect), SVG art as fallback
    jobs.push(
      loadImg(`/assets/products-photo/${slug}.png`)
        .then((im) => {
          const c = document.createElement('canvas'); c.width = c.height = 160;
          const k = Math.min(148 / im.width, 148 / im.height), w = im.width * k, h = im.height * k;
          c.getContext('2d').drawImage(im, (160 - w) / 2, 160 - h - 6, w, h);
          return c;
        })
        .catch(() => loadImg(`/assets/products/${slug}.svg`).then((im) => raster(im, 160, 160)))
        .then((c) => { out.products[slug] = c; tick(); })
    );
  }
  for (const [name, fp] of Object.entries(manifest.props)) {
    jobs.push(loadImg(`/assets/props/${name}.svg`).then((im) => { out.propImg[name] = im; out.props[name] = fp; tick(); }));
  }
  for (const dir of ['down', 'up', 'left', 'right']) {
    out.shopper[dir] = [];
    for (let f = 0; f < 4; f++) {
      jobs.push(
        fetch(`/assets/shopper/walk-${dir}-${f}.svg`).then((r) => r.text()).then((t) => {
          const m = { '#25a59e': '#2F63DB', '#145f5a': '#12328f', '#277c75': '#1d4bb5', '#71c2b9': '#6f9bff',
            '#d6403a': '#1F57E0', '#98332d': '#123a99', '#b03832': '#1a49c0', '#ab3731': '#1a49c0',
            '#95332c': '#123a99', '#89302a': '#123a99', '#e2776f': '#7aa2ff', '#e1746b': '#7aa2ff' };
          const s = t.replace(/#[0-9a-fA-F]{6}/g, (c) => m[c.toLowerCase()] || c);
          return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s));
        }).then((im) => { out.shopper[dir][f] = raster(im, 216, 216); tick(); })
      );
    }
  }
  jobs.push(loadImg('/assets/textures/floor.jpg').then((im) => { out.floor = im; }).catch(() => {}));
  await Promise.all(jobs);
  return out;
}
