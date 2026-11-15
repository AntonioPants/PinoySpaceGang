import * as T from 'three';

/**
 * The title's flight: a small ship seen from behind, racing through streaking stars and
 * galactic haze towards a bright point ahead, the solar system. Everything in `rig` rides
 * with the camera (add it to the camera); `beacon` is that bright point (add it to the scene,
 * where the three worlds are). Generated in code: no image or model files.
 */
export function buildTitleFlight() {
  const rig = new T.Group(), textures: T.Texture[] = [];
  let seed = 90217;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // ---- the ship: nose towards -z (away from the camera), engines towards the viewer
  const ship = new T.Group();
  const hull = new T.MeshStandardMaterial({ color: 0xe6e1d6, metalness: .1, roughness: .62, flatShading: true });
  const dark = new T.MeshStandardMaterial({ color: 0x555a64, metalness: .15, roughness: .6, flatShading: true });
  const trim = new T.MeshStandardMaterial({ color: 0xdfc28d, metalness: .2, roughness: .5, flatShading: true });
  const body = new T.Mesh(new T.CylinderGeometry(.15, .34, 2.4, 10).rotateX(-Math.PI / 2), hull);
  const nose = new T.Mesh(new T.ConeGeometry(.15, .95, 10).rotateX(-Math.PI / 2), hull); nose.position.z = -1.67;
  const canopy = new T.Mesh(new T.SphereGeometry(.17, 12, 8), new T.MeshStandardMaterial({ color: 0x0d1820, metalness: .9, roughness: .15, emissive: 0x16323c }));
  canopy.scale.set(1, .7, 2.1); canopy.position.set(0, .18, -.6);
  const band = new T.Mesh(new T.CylinderGeometry(.262, .285, .16, 10).rotateX(-Math.PI / 2), trim); band.position.z = .25;
  ship.add(body, nose, canopy, band);
  const plate = (points: number[], material: T.Material) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setIndex(points.length === 12 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]); geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material); (material as T.MeshStandardMaterial).side = T.DoubleSide; return mesh;
  };
  const flames: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    // swept wing, tail fin, engine pod, and the exhaust behind it
    ship.add(plate([side * .24, 0, -.35, side * .24, 0, 1.15, side * 1.55, -.08, 1.3, side * 1.55, -.08, .95], hull));
    ship.add(plate([side * .36, .05, .55, side * .36, .05, 1.2, side * .52, .62, 1.3], dark));
    const pod = new T.Mesh(new T.CylinderGeometry(.15, .13, .8, 10).rotateX(-Math.PI / 2), dark); pod.position.set(side * .5, -.02, .95); ship.add(pod);
    const glow = new T.Mesh(new T.CircleGeometry(.12, 16), new T.MeshBasicMaterial({ color: 0xfff1d2, fog: false })); glow.position.set(side * .5, -.02, 1.36); ship.add(glow);
    const flame = new T.Mesh(new T.ConeGeometry(.12, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, .5),
      new T.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    flame.position.set(side * .5, -.02, 1.36); ship.add(flame); flames.push(flame);
  }
  ship.scale.setScalar(.82); rig.add(ship);

  // ---- streaking stars, in the camera's frame: each is a short line from head to tail
  const COUNT = 1100, DEPTH = 150, heads = new Float32Array(COUNT * 3), speeds = new Float32Array(COUNT), lines = new Float32Array(COUNT * 6);
  for (let i = 0; i < COUNT; i++) {
    let x = 0, y = 0;
    // none straight ahead: they would fly out of the ship and through the title
    do { x = (random() * 2 - 1) * 70; y = (random() * 2 - 1) * 42; } while (Math.hypot(x, y * 1.5) < 5);
    heads.set([x, y, 6 - random() * DEPTH], i * 3); speeds[i] = 45 + random() * 75;
  }
  const streakGeometry = new T.BufferGeometry(), streakPositions = new T.BufferAttribute(lines, 3);
  streakGeometry.setAttribute('position', streakPositions);
  const streakMaterial = new T.LineBasicMaterial({ color: 0xf3ecdc, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const streaks = new T.LineSegments(streakGeometry, streakMaterial); streaks.frustumCulled = false; rig.add(streaks);

  // ---- galactic haze far behind everything: soft clouds of cold blue and warm gold
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let i = 0; i < 46; i++) {
      // gathered along a tilted band, like a galaxy seen edge-on
      const x = random() * 1024, y = 256 + (x - 512) * .18 + (random() - .5) * 230, r = 60 + random() * 190;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, r), tone = i % 3 === 0 ? '223,194,141' : i % 3 === 1 ? '96,128,168' : '150,112,160';
      cloud.addColorStop(0, `rgba(${tone},${.05 + random() * .09})`); cloud.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = cloud; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(240,232,214,${random() * .5})`; ctx.fillRect(random() * 1024, random() * 512, 1, 1); }
  }
  const hazeTexture = new T.CanvasTexture(canvas); hazeTexture.colorSpace = T.SRGBColorSpace; textures.push(hazeTexture);
  const hazeMaterial = new T.MeshBasicMaterial({ map: hazeTexture, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const haze = new T.Mesh(new T.PlaneGeometry(640, 320), hazeMaterial); haze.position.z = -265; haze.renderOrder = -5; rig.add(haze);

  // ---- the destination: a bright point with a soft halo
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
  const glowCtx = glowCanvas.getContext('2d');
  if (glowCtx) {
    const halo = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    halo.addColorStop(0, 'rgba(255,250,235,1)'); halo.addColorStop(.12, 'rgba(255,236,196,.85)'); halo.addColorStop(.4, 'rgba(223,194,141,.22)'); halo.addColorStop(1, 'rgba(223,194,141,0)');
    glowCtx.fillStyle = halo; glowCtx.fillRect(0, 0, 128, 128);
  }
  const glowTexture = new T.CanvasTexture(glowCanvas); glowTexture.colorSpace = T.SRGBColorSpace; textures.push(glowTexture);
  const beaconMaterial = new T.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  const beacon = new T.Sprite(beaconMaterial); beacon.scale.setScalar(9);

  let warp = 0, hazeLevel = 0, clock = 0;
  return {
    rig, beacon, textures,
    /**
     * `stage`: where the game is. `arrival`: 0..1 while the title is flying in to the worlds, else null.
     * `hidden`: 0..1, how much of the worlds is still out of sight (the beacon stands in for them).
     */
    update(dt: number, stage: string, arrival: number | null, hidden: number, still: boolean) {
      clock += dt;
      const cruising = stage === 'title' && arrival === null;
      // Star speed: full on the title, braking through the arrival, a slow drift over the worlds, then none.
      const goal = cruising ? 1 : arrival !== null ? T.MathUtils.lerp(1, .03, T.MathUtils.smoothstep(arrival, 0, .62)) : stage === 'worlds' ? .03 : 0;
      warp = arrival !== null ? goal : warp + (goal - warp) * (1 - Math.exp(-2.5 * dt));
      streaks.visible = warp > .002; streakMaterial.opacity = Math.min(1, warp * 12) * .85;
      if (streaks.visible) {
        const moving = still ? 0 : warp;
        for (let i = 0; i < COUNT; i++) {
          let z = heads[i * 3 + 2] + speeds[i] * moving * dt; if (z > 6) z -= DEPTH; heads[i * 3 + 2] = z;
          const x = heads[i * 3], y = heads[i * 3 + 1], tail = Math.max(.05, speeds[i] * warp * .055);
          lines.set([x, y, z, x, y, z - tail], i * 6);
        }
        streakPositions.needsUpdate = true;
      }
      const hazeGoal = stage === 'title' ? 1 : stage === 'worlds' ? .5 : 0;
      hazeLevel += (hazeGoal - hazeLevel) * (1 - Math.exp(-1.8 * dt));
      haze.visible = hazeLevel > .01; hazeMaterial.opacity = hazeLevel * .9;
      beaconMaterial.opacity = hidden; beacon.visible = hidden > .01;
      beacon.scale.setScalar(9 * (1 + .06 * Math.sin(clock * 2.3)) * (1 + (arrival ?? 0) * 2));
      // The ship holds station ahead of the camera, weaving a little; on arrival it pulls away into the system.
      const away = arrival === null ? 0 : Math.pow(Math.min(arrival / .42, 1), 2.4);
      ship.visible = cruising || (arrival !== null && arrival < .42);
      const sway = still ? 0 : 1;
      ship.position.set(Math.sin(clock * .55) * .8 * sway, .45 + Math.sin(clock * .9) * .12 * sway + away * 1.6, -9 - away * 190);
      ship.rotation.set(.2, Math.sin(clock * .55 + 1.2) * .05 * sway, -Math.cos(clock * .55) * .22 * sway);
      flames.forEach((flame, i) => flame.scale.set(1, 1, (1.1 + Math.sin(clock * 31 + i * 2) * .25) * (1 + away * 5)));
    },
  };
}
