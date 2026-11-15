import * as T from 'three';
import { EARTH_CENTRE, EARTH_RADIUS } from './earthSurface';

/**
 * The title's launch. A Space Shuttle stack (orbiter, external tank, two solid boosters) stands
 * on a floodlit pad before dawn, under the bright point that is the solar system's three worlds.
 * On the start click it plays, in order: main-engine start, booster ignition and liftoff through
 * its own smoke, the climb out of the atmosphere, booster separation, tank separation, and the
 * orbiter's long glide towards the bright point, where the worlds appear and it settles into
 * orbit around Earth, without leaving the frame.
 *
 * Everything in `rig` rides with the camera (add it to the camera); `beacon` is the bright point
 * (add it to the scene, where the worlds are). Generated in code: no image or model files.
 * The shuttle is an illustration with real proportions (metres, see the constants), not a
 * surveyed model, and the ascent is staged for the screen, not simulated.
 */

/** Seconds from the start click until the camera starts flying in to the worlds: the launch. */
export const LAUNCH_SECONDS = 6.4;
/** Rig units per metre: the 56 m stack stands about 4.6 units tall, 16 units from the camera. */
const S = .082;
const T_SRB = 1, T_SRB_SEP = 3.95, T_TANK_SEP = 5.3;
const { smoothstep, smootherstep, lerp } = T.MathUtils;
/** After the jump the orbiter circles Earth on the world screen: orbit radius, model scale and plane. Staged, not to scale. */
const ORBIT_RADIUS = EARTH_RADIUS * 1.5, ORBIT_SCALE = .0085, ORBIT_U = new T.Vector3(1, 0, 0), ORBIT_V = new T.Vector3(0, .3, 1).normalize();

export function buildTitleFlight() {
  const rig = new T.Group(), textures: T.Texture[] = [];
  let seed = 90217;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const canvasTexture = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (ctx) draw(ctx);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8; textures.push(texture); return texture;
  };
  const radial = (size: number, stops: [number, string][]) => canvasTexture(size, size, ctx => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([at, colour]) => g.addColorStop(at, colour)); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  });

  // ---- textures
  // Reflections: a painted sky, so metal and glass have something to mirror.
  const environment = canvasTexture(512, 256, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#2a3446'); sky.addColorStop(.45, '#0b0e14'); sky.addColorStop(.55, '#07080b'); sky.addColorStop(1, '#3a2a1c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
    const sun = ctx.createRadialGradient(390, 70, 0, 390, 70, 90);
    sun.addColorStop(0, 'rgba(255,244,220,1)'); sun.addColorStop(.15, 'rgba(255,220,170,.8)'); sun.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, 512, 256);
  });
  environment.mapping = T.EquirectangularReflectionMapping;
  const glowTexture = radial(128, [[0, 'rgba(255,255,255,1)'], [.12, 'rgba(255,255,255,.85)'], [.4, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]);
  const heatTexture = radial(64, [[0, '#fffaf0'], [.3, '#ffd28a'], [.7, '#e8742c'], [1, '#5a1a10']]);
  const puffTexture = canvasTexture(128, 128, ctx => {
    for (let i = 0; i < 11; i++) {
      const x = 64 + (random() - .5) * 46, y = 64 + (random() - .5) * 46, r = 20 + random() * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    }
  });
  // The orbiter's skin, wrapped around its fuselage: u runs around (0 = the top centreline,
  // .5 = the belly), v runs from the tail (bottom of the canvas) to the nose (top).
  const orbiterSkin = canvasTexture(1024, 1024, ctx => {
    const X = (u: number) => u * 1024, Y = (v: number) => (1 - v) * 1024;
    ctx.fillStyle = '#f1efe9'; ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(${random() < .5 ? '110,108,100' : '255,255,255'},${random() * .07})`; ctx.fillRect(random() * 1024, random() * 1024, 10 + random() * 50, 6 + random() * 22); }
    // black heat-shield tiles under the belly, with a faint tile grid
    ctx.fillStyle = '#131518'; ctx.fillRect(X(.3), 0, X(.4), 1024);
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (let x = X(.3); x < X(.7); x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    for (let y = 0; y < 1024; y += 14) { ctx.beginPath(); ctx.moveTo(X(.3), y); ctx.lineTo(X(.7), y); ctx.stroke(); }
    // grey nose cap, and the black thruster patch behind it on top
    ctx.fillStyle = '#2b2d31'; ctx.fillRect(0, 0, 1024, Y(.945));
    ctx.fillStyle = '#17191c'; for (const x of [0, X(.93)]) ctx.fillRect(x, Y(.945), X(.07), Y(.9) - Y(.945));
    // six flight-deck windows, wrapped across the top centreline
    ctx.fillStyle = '#07090c';
    for (const u of [.012, .058, .104]) for (const side of [1, -1]) {
      const x = X(side > 0 ? u : 1 - u - .038); ctx.beginPath();
      ctx.moveTo(x, Y(.845)); ctx.lineTo(x + X(.038), Y(.845)); ctx.lineTo(x + X(.034), Y(.885)); ctx.lineTo(x + X(.004), Y(.885)); ctx.closePath(); ctx.fill();
    }
    // payload-bay doors: centreline, hinge lines and frames
    ctx.strokeStyle = 'rgba(70,70,70,.7)'; ctx.lineWidth = 2;
    for (const u of [.001, .999, .2, .8]) { ctx.beginPath(); ctx.moveTo(X(u), Y(.1)); ctx.lineTo(X(u), Y(.66)); ctx.stroke(); }
    for (let v = .1; v <= .67; v += .112) for (const [u0, u1] of [[0, .2], [.8, 1]]) { ctx.beginPath(); ctx.moveTo(X(u0), Y(v)); ctx.lineTo(X(u1), Y(v)); ctx.stroke(); }
    // fine panel seams over the white upper surface, thruster ports on the nose and by the tail
    ctx.strokeStyle = 'rgba(80,80,84,.22)'; ctx.lineWidth = 1;
    for (let v = .04; v < .94; v += .028) for (const [u0, u1] of [[0, .3], [.7, 1]]) { ctx.beginPath(); ctx.moveTo(X(u0), Y(v)); ctx.lineTo(X(u1), Y(v)); ctx.stroke(); }
    for (const u of [.05, .1, .15, .25, .75, .85, .9, .95]) { ctx.beginPath(); ctx.moveTo(X(u), Y(.04)); ctx.lineTo(X(u), Y(.93)); ctx.stroke(); }
    ctx.fillStyle = '#0b0c0e';
    for (const u of [.13, .16, .19, .81, .84, .87]) for (const v of [.905, .925]) { ctx.beginPath(); ctx.arc(X(u), Y(v), 5, 0, 6.28); ctx.fill(); }
    for (const u of [.2, .23, .77, .8]) for (const v of [.03, .05, .07]) { ctx.beginPath(); ctx.arc(X(u), Y(v), 4, 0, 6.28); ctx.fill(); }
    // black surround under the windows and a thin dark stripe along each side
    ctx.fillStyle = '#1a1c20'; ctx.fillRect(0, Y(.845), X(.15), 6); ctx.fillRect(X(.85), Y(.845), X(.15), 6);
    ctx.fillRect(X(.285), Y(.9), 5, Y(.05) - Y(.9)); ctx.fillRect(X(.71), Y(.9), 5, Y(.05) - Y(.9));
    // the ship's name on both sides, reading towards the nose
    ctx.fillStyle = '#15171a'; ctx.font = '600 30px "DM Mono", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const u of [.25, .75]) { ctx.save(); ctx.translate(X(u), Y(.74)); ctx.rotate(-Math.PI / 2); ctx.fillText('ANALOG ATLAS', 0, 0); ctx.restore(); }
  });
  // The wing's upper surface: x is 0..12 m of span, y is 0..28 m along the ship (tail at the bottom).
  const wingSkin = canvasTexture(512, 1024, ctx => {
    const X = (m: number) => m / 12 * 512, Y = (m: number) => (1 - m / 28) * 1024;
    ctx.fillStyle = '#efede7'; ctx.fillRect(0, 0, 512, 1024);
    ctx.strokeStyle = 'rgba(80,80,84,.22)'; ctx.lineWidth = 1;
    for (let m = 0; m < 28; m += 1.3) { ctx.beginPath(); ctx.moveTo(0, Y(m)); ctx.lineTo(512, Y(m)); ctx.stroke(); }
    for (let m = 0; m < 12; m += 1.3) { ctx.beginPath(); ctx.moveTo(X(m), 0); ctx.lineTo(X(m), 1024); ctx.stroke(); }
    // grey reinforced leading edge, then the elevons along the trailing edge
    ctx.strokeStyle = '#3b3e44'; ctx.lineWidth = X(1.1); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(X(1.5), Y(27)); ctx.lineTo(X(4.7), Y(15.2)); ctx.lineTo(X(11.9), Y(5.2)); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,30,34,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X(2.8), Y(3.4)); ctx.lineTo(X(11.9), Y(4.7)); ctx.moveTo(X(7.2), Y(4.05)); ctx.lineTo(X(7.2), Y(1.9)); ctx.stroke();
    ctx.fillStyle = '#15171a'; ctx.fillRect(X(5.2), Y(9.6), X(2.6), 7); ctx.fillRect(X(5.2), Y(9.1), X(1.6), 7);
  });
  wingSkin.wrapS = T.MirroredRepeatWrapping; wingSkin.wrapT = T.RepeatWrapping; wingSkin.repeat.set(1 / 12, 1 / 28);
  const foam = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#c4622b'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 9) { ctx.fillStyle = `rgba(70,26,8,${.05 + random() * .09})`; ctx.fillRect(0, y, 256, 2); }
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${random() < .5 ? '90,36,12' : '238,150,84'},${random() * .1})`; ctx.fillRect(random() * 256, random() * 256, 3 + random() * 22, 2 + random() * 6); }
  });
  const ribs = canvasTexture(256, 32, ctx => {
    ctx.fillStyle = '#a44f22'; ctx.fillRect(0, 0, 256, 32);
    for (let x = 0; x < 256; x += 8) { ctx.fillStyle = 'rgba(40,14,4,.55)'; ctx.fillRect(x, 0, 3, 32); }
  });

  // ---- materials
  const metal = (colour: number, metalness: number, roughness: number, extra: T.MeshStandardMaterialParameters = {}) =>
    new T.MeshStandardMaterial({ color: colour, metalness, roughness, envMap: environment, envMapIntensity: .55, ...extra });
  const white = metal(0xf1efe9, .1, .55), black = metal(0x15171a, .15, .7), skin = metal(0xffffff, .1, .55, { map: orbiterSkin }), wingTop = metal(0xffffff, .1, .55, { map: wingSkin });
  const boosterWhite = metal(0xeeece6, .15, .5), tankOrange = metal(0xffffff, 0, .95, { map: foam, envMapIntensity: .1 }), tankRibs = metal(0xffffff, 0, .9, { map: ribs, envMapIntensity: .1 });
  const nozzle = metal(0x4a443d, .85, .32, { side: T.DoubleSide, envMapIntensity: 1 }), steel = metal(0x6c7078, .7, .45);
  const profile = (points: number[][]) => points.map(([r, y]) => new T.Vector2(r, y));
  const glowSprite = (colour: number, size: number, opacity = 1) => {
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: glowTexture, color: colour, opacity, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    sprite.scale.setScalar(size); return sprite;
  };
  // Exhaust: a hot core inside a softer edge, with shock diamonds running down it. The nozzle is
  // at the mesh's origin and the plume runs down -y; scale.y is its length.
  const flames: { mesh: T.Mesh; material: T.ShaderMaterial; length: number; booster: boolean }[] = [];
  const flame = (parent: T.Object3D, x: number, y: number, z: number, r0: number, r1: number, length: number, core: number, edge: number, booster: boolean) => {
    const material = new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, power: { value: 0 }, core: { value: new T.Color(core) }, edge: { value: new T.Color(edge) } },
      // The world renderer uses a logarithmic depth buffer, so the shader carries its chunks.
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying float vFacing;
        void main(){ vUv = uv; vec4 view = modelViewMatrix * vec4(position,1.); vec3 n = normalize(normalMatrix * normal);
          vFacing = abs(dot(n, normalize(-view.xyz))); gl_Position = projectionMatrix * view;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform float time; uniform float power; uniform vec3 core; uniform vec3 edge; varying vec2 vUv; varying float vFacing;
        void main(){
          #include <logdepthbuf_fragment>
          float along = 1. - vUv.y; // 0 at the nozzle, 1 at the tail
          float fade = pow(1. - along, 1.5);
          float diamonds = .78 + .22 * sin(along * 30. - time * 40.);
          float heat = pow(vFacing, 1.3);
          vec3 colour = mix(edge, core, clamp(heat * (1.25 - along), 0., 1.));
          gl_FragColor = vec4(colour * diamonds * (.6 + power), fade * (.3 + .7 * heat) * min(power, 1.)); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    });
    const mesh = new T.Mesh(new T.CylinderGeometry(r0, r1, 1, 24, 1, true).translate(0, -.5, 0), material);
    mesh.position.set(x, y, z); mesh.visible = false; parent.add(mesh); flames.push({ mesh, material, length, booster });
  };
  /** An engine bell opening down -y from (x, y, z), with its glowing throat. */
  const throats: { mesh: T.Mesh; booster: boolean }[] = [];
  const bell = (parent: T.Object3D, x: number, y: number, z: number, throat: number, exit: number, length: number, booster: boolean) => {
    const cone = new T.Mesh(new T.LatheGeometry(profile([[throat, 0], [throat * 1.3, -length * .2], [exit * .8, -length * .55], [exit * .97, -length * .88], [exit, -length]]), 28), nozzle);
    const hot = new T.Mesh(new T.CircleGeometry(lerp(throat, exit, .45), 24).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ map: heatTexture, fog: false }));
    cone.position.set(x, y, z); hot.position.set(x, y - length * .4, z); hot.visible = false; parent.add(cone, hot); throats.push({ mesh: hot, booster });
  };

  // ---- the stack, in metres. `stack` turns about the orbiter's middle; `core` holds the
  // vehicle with y up from the booster skirts and the orbiter on the +z side of the tank.
  const stack = new T.Group(), core = new T.Group(); core.position.set(0, -22, -7.4); stack.add(core); stack.scale.setScalar(S);

  // Orbiter: nose +y, top (payload bay) +z, wings along x. 37 m long, 23.8 m span.
  const orbiter = new T.Group(); orbiter.position.set(0, 5.5, 7.4); core.add(orbiter);
  const LENGTH = 32.9, hullProfile = [[0, 0]];
  for (let i = 0; i <= 44; i++) {
    const y = LENGTH * i / 44, nose = Math.max(0, (y - 21) / (LENGTH - 21));
    hullProfile.push([y < 1 ? 2.5 + .2 * y : 2.7 * Math.sqrt(Math.max(0, 1 - nose ** 2.3)), y]);
  }
  const fuselage = new T.Mesh(new T.LatheGeometry(profile(hullProfile), 56), skin); orbiter.add(fuselage);
  // Double-delta wing: a white upper surface over black tiles.
  const wingShape = (side: number) => new T.Shape([[1.5, 27], [4.7, 15.2], [11.9, 5.2], [11.9, 2.7], [1.5, 1.2]].map(([x, y]) => new T.Vector2(x * side, y)));
  for (const side of [-1, 1]) {
    const top = new T.Mesh(new T.ExtrudeGeometry(wingShape(side), { depth: .3, bevelEnabled: false }), wingTop); top.position.z = -1.95;
    const tiles = new T.Mesh(new T.ExtrudeGeometry(wingShape(side), { depth: .4, bevelEnabled: true, bevelThickness: .12, bevelSize: .2, bevelSegments: 1 }), black); tiles.position.z = -2.4;
    // orbital-manoeuvring pod beside the tail, with its small engine
    const pod = new T.Mesh(new T.SphereGeometry(1, 20, 14), white); pod.scale.set(1.15, 3.7, 1.15); pod.position.set(side * 1.8, 3, 1.85);
    orbiter.add(top, tiles, pod); bell(orbiter, side * 1.8, -.4, 1.85, .25, .55, 1, false);
  }
  // Vertical tail: its outline is drawn in (height above the fuselage axis, length along it).
  const tail = new T.Mesh(new T.ExtrudeGeometry(new T.Shape([[2.3, 9.8], [10.8, 3.4], [10.8, .5], [2.3, 1]].map(([z, y]) => new T.Vector2(z, y))), { depth: .5, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(.25, 0, 0), white);
  const tailEdge = new T.Mesh(new T.BoxGeometry(.56, 10.7, .35), black); tailEdge.position.set(0, 6.6, 6.55); tailEdge.rotation.x = -Math.atan2(8.5, 6.4);
  const flap = new T.Mesh(new T.BoxGeometry(5.4, 2.2, .35), black); flap.position.set(0, -.3, -2.3);
  orbiter.add(tail, tailEdge, flap);
  // three main engines
  const mains: [number, number][] = [[0, 1.35], [-1.3, -.75], [1.3, -.75]];
  for (const [x, z] of mains) { bell(orbiter, x, 0, z, .45, 1.15, 3, false); flame(orbiter, x, -2.7, z, .95, .35, 11, 0xf2f9ff, 0x4f9dff, false); }
  const mainGlow = glowSprite(0xa8d0ff, 9, 0); mainGlow.position.set(0, -3.4, 0); orbiter.add(mainGlow);

  // External tank: 47 m long, 8.4 m across, orange foam with a ribbed intertank.
  const tank = new T.Group(); core.add(tank);
  tank.add(new T.Mesh(new T.LatheGeometry(profile([[0, 5], [2.6, 5.3], [3.8, 6.4], [4.2, 8.2], [4.2, 39.5], [3.95, 43], [3.2, 47], [2, 50.2], [.7, 51.6], [.25, 51.9], [.2, 52.7], [0, 52.8]]), 48), tankOrange));
  const intertank = new T.Mesh(new T.CylinderGeometry(4.27, 4.27, 6.6, 48, 1, true), tankRibs); intertank.position.y = 35; tank.add(intertank);
  const feedline = new T.Mesh(new T.CylinderGeometry(.24, .24, 28, 10), tankRibs); feedline.position.set(2.6, 22.5, 3.5);
  const tray = new T.Mesh(new T.BoxGeometry(.32, 41, .22), tankRibs); tray.position.set(-2.2, 27, 3.66);
  const ventCap = new T.Mesh(new T.CylinderGeometry(.5, .9, .5, 16), steel); ventCap.position.y = 51.4; tank.add(feedline, tray, ventCap);
  for (const y of [9, 37]) { const strut = new T.Mesh(new T.BoxGeometry(1.2, .5, 2.4), steel); strut.position.set(0, y, 4.6); tank.add(strut); }

  // Solid rocket boosters: 45.5 m long, 3.7 m across, either side of the tank.
  const boosters = [-1, 1].map(side => {
    const booster = new T.Group(); booster.position.x = side * 6.3; core.add(booster);
    booster.add(new T.Mesh(new T.LatheGeometry(profile([[2.55, 0], [2.55, .5], [1.92, 2.8], [1.85, 2.8], [1.85, 40], [1, 44], [.35, 45.3], [0, 45.5]]), 32), boosterWhite));
    for (const y of [3.1, 11, 21, 31, 39.6]) { const band = new T.Mesh(new T.CylinderGeometry(1.89, 1.89, y > 39 ? .9 : .45, 32, 1, true), black); band.position.y = y; booster.add(band); }
    for (const y of [8, 15.5, 26, 35.5]) { const joint = new T.Mesh(new T.CylinderGeometry(1.93, 1.93, .2, 32, 1, true), steel); joint.position.y = y; booster.add(joint); }
    const skirtRing = new T.Mesh(new T.CylinderGeometry(2.6, 2.6, .25, 32, 1, true), steel); skirtRing.position.y = .9;
    const tunnel = new T.Mesh(new T.BoxGeometry(.3, 33, .26), boosterWhite); tunnel.position.set(side * 1.9, 21, 0);
    const tip = new T.Mesh(new T.ConeGeometry(.37, 1, 16), steel); tip.position.y = 45.35; booster.add(skirtRing, tunnel, tip);
    bell(booster, 0, .4, 0, 1, 1.9, 2.2, true);
    flame(booster, 0, -1.5, 0, 1.75, 3.6, 40, 0xfff6dc, 0xff8a2a, true);
    flame(booster, 0, -1.5, 0, 1.2, 1.5, 22, 0xffffff, 0xffe2a0, true);
    const glow = glowSprite(0xffb060, 26, 0); glow.position.y = -4; booster.add(glow);
    return { group: booster, side, glow };
  });
  const fire = new T.PointLight(0xffa860, 0, 60, 1.4); fire.position.set(0, -6, 3); core.add(fire);

  // ---- the launch site, in rig units. `world` tilts as the camera follows the climb;
  // `site` (and the smoke) drop away beneath it.
  const world = new T.Group(), site = new T.Group(), smoke = new T.Group(); rig.add(world); world.add(site, smoke, stack);
  const GROUND = -.5, PAD = new T.Vector3(1.7, GROUND + .34 + 22 * S, -19);
  /** The pad is seen from slightly above, which lifts it clear of the title's lettering. */
  const LOOK_DOWN = .07;
  const skyMaterial = new T.MeshBasicMaterial({
    map: canvasTexture(8, 512, ctx => {
      const g = ctx.createLinearGradient(0, 512, 0, 0);
      g.addColorStop(0, 'rgba(255,176,112,.96)'); g.addColorStop(.05, 'rgba(226,120,104,.86)'); g.addColorStop(.16, 'rgba(110,70,122,.7)');
      g.addColorStop(.36, 'rgba(34,44,96,.55)'); g.addColorStop(.7, 'rgba(10,16,44,.28)'); g.addColorStop(1, 'rgba(6,10,30,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512);
    }), transparent: true, depthWrite: false, fog: false,
  });
  const far = new T.Group(), sky = new T.Mesh(new T.PlaneGeometry(900, 190), skyMaterial); sky.position.set(0, GROUND + 95, -240); sky.renderOrder = -4; far.add(sky); world.add(far);
  // The ground: dark flats that pick up the dawn towards the horizon.
  const groundMaterial = new T.MeshBasicMaterial({
    map: canvasTexture(8, 256, ctx => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#4a3038'); g.addColorStop(.06, '#1c1620'); g.addColorStop(.3, '#0a0b10'); g.addColorStop(1, '#050608');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
    }), transparent: true, fog: false,
  });
  const ground = new T.Mesh(new T.PlaneGeometry(900, 244).rotateX(-Math.PI / 2), groundMaterial); ground.position.set(0, GROUND, -120); ground.renderOrder = -3; site.add(ground);
  const pool = (size: number, colour: number) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: glowTexture, color: colour, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    mesh.position.set(PAD.x, GROUND + .01, PAD.z); mesh.renderOrder = -2; site.add(mesh); return mesh.material;
  };
  const floodPool = pool(26, 0x8fa4c8), firePool = pool(70, 0xff9a4a);
  // Mobile launcher platform and the service tower beside it.
  const solids: T.MeshStandardMaterial[] = [];
  const dull = (colour: number) => { const m = new T.MeshStandardMaterial({ color: colour, metalness: .3, roughness: .8, transparent: true }); solids.push(m); return m; };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: T.Material) => { const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); site.add(mesh); return mesh; };
  const platform = new T.Mesh(new T.BoxGeometry(3.6, .34, 2.6), dull(0x5a5d63)); platform.position.set(PAD.x, GROUND + .17, PAD.z); site.add(platform);
  const TOWER_X = PAD.x + 1.85, TOWER_Z = PAD.z - .5, TOWER_H = 5, W = .3, lattice: number[] = [];
  for (let level = 0; level < 12; level++) {
    const y0 = GROUND + TOWER_H * level / 12, y1 = GROUND + TOWER_H * (level + 1) / 12;
    const corners = [[-W, -W], [W, -W], [W, W], [-W, W]];
    corners.forEach(([x, z], i) => {
      const [nx, nz] = corners[(i + 1) % 4];
      lattice.push(TOWER_X + x, y0, TOWER_Z + z, TOWER_X + x, y1, TOWER_Z + z, TOWER_X + x, y1, TOWER_Z + z, TOWER_X + nx, y1, TOWER_Z + nz,
        TOWER_X + (level % 2 ? nx : x), y0, TOWER_Z + (level % 2 ? nz : z), TOWER_X + (level % 2 ? x : nx), y1, TOWER_Z + (level % 2 ? z : nz));
    });
  }
  // The rotating service structure: a braced box frame swung back from the vehicle.
  const frame = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, levels: number) => {
    for (let i = 0; i <= levels; i++) {
      const y = lerp(y0, y1, i / levels), next = lerp(y0, y1, (i + 1) / levels);
      lattice.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
      if (i < levels) lattice.push(x0, y, z1, x1, next, z1, x1, y, z1, x0, next, z1, x1, y, z0, x1, next, z1);
    }
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) lattice.push(x, y0, z, x, y1, z);
  };
  frame(TOWER_X + .4, TOWER_X + 1.7, GROUND + 1.1, GROUND + 3.9, TOWER_Z - .7, TOWER_Z + .25, 5);
  frame(TOWER_X + .55, TOWER_X + 1.55, GROUND, GROUND + 1.1, TOWER_Z - .55, TOWER_Z + .1, 2);
  box(1.1, 2.5, .7, TOWER_X + 1.05, GROUND + 2.5, TOWER_Z - .25, dull(0x1b1e23));
  for (let level = 2; level <= 12; level += 2) box(W * 2.5, .035, W * 2.5, TOWER_X, GROUND + TOWER_H * level / 12, TOWER_Z, dull(0x565a62));
  // Vent arm to the tank's tip with its cap, the crew's white room, and masts on the platform.
  box(1.2, .06, .09, TOWER_X - .85, GROUND + 4.72, TOWER_Z, dull(0x8a8d95));
  box(.3, .22, .3, PAD.x + .5, GROUND + 3.25, TOWER_Z + .35, dull(0xd9d7d0));
  for (const x of [-.55, .25]) box(.14, .75, .14, PAD.x + x, GROUND + .7, PAD.z - .75, dull(0x70747c));
  // Floodlight masts, a water tower, and the crawlerway running out towards the camera.
  const lampGlows: T.Sprite[] = [];
  for (const [x, z] of [[-4.6, 1.5], [-6.2, -3], [6.4, 2.2]]) {
    const pole = new T.Mesh(new T.CylinderGeometry(.03, .05, 3.4, 6), dull(0x666a72)); pole.position.set(PAD.x + x, GROUND + 1.7, PAD.z + z); site.add(pole);
    for (let i = 0; i < 6; i++) { const lamp = glowSprite(0xf2f6ff, .3); lamp.position.set(PAD.x + x + (i % 3 - 1) * .14, GROUND + 3.4 + Math.floor(i / 3) * .13, PAD.z + z); site.add(lamp); lampGlows.push(lamp); }
    const bloom = glowSprite(0xcfdcff, 1.6, .5); bloom.position.set(PAD.x + x, GROUND + 3.45, PAD.z + z); site.add(bloom); lampGlows.push(bloom);
  }
  const waterLeg = new T.Mesh(new T.CylinderGeometry(.1, .14, 3, 8), dull(0x7c8088)); waterLeg.position.set(PAD.x + 8.5, GROUND + 1.5, PAD.z - 7);
  const waterTank = new T.Mesh(new T.CylinderGeometry(.75, .6, .8, 16), dull(0xb4b6ba)); waterTank.position.set(PAD.x + 8.5, GROUND + 3.3, PAD.z - 7); site.add(waterLeg, waterTank);
  const crawlerway = new T.Mesh(new T.PlaneGeometry(2.6, 60).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x16181d, transparent: true, fog: false }));
  crawlerway.position.set(PAD.x, GROUND + .004, PAD.z + 30); crawlerway.renderOrder = -2; site.add(crawlerway);
  // Far lights along the horizon, and thin cloud catching the dawn.
  const townPoints = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) townPoints.set([(random() - .5) * 420, GROUND + .4 + random() * 1.6, -232 + random() * 6], i * 3);
  const townGeometry = new T.BufferGeometry(); townGeometry.setAttribute('position', new T.BufferAttribute(townPoints, 3));
  const townMaterial = new T.PointsMaterial({ color: 0xffd9a0, size: 1.1, sizeAttenuation: true, transparent: true, depthWrite: false, fog: false });
  site.add(new T.Points(townGeometry, townMaterial));
  const clouds = Array.from({ length: 10 }, (_, i) => {
    const material = new T.SpriteMaterial({ map: puffTexture, color: new T.Color(i % 2 ? 0xff9a7a : 0xb07aa8), transparent: true, depthWrite: false, fog: false });
    const cloud = new T.Sprite(material); cloud.position.set((random() - .5) * 400, GROUND + 5 + random() * 28, -228); cloud.scale.set(70 + random() * 90, 5 + random() * 6, 1); cloud.renderOrder = -3; far.add(cloud);
    return { material, level: .25 + random() * .3 };
  });
  const latticeGeometry = new T.BufferGeometry(); latticeGeometry.setAttribute('position', new T.Float32BufferAttribute(lattice, 3));
  const latticeMaterial = new T.LineBasicMaterial({ color: 0xa9afba, transparent: true, fog: false });
  site.add(new T.LineSegments(latticeGeometry, latticeMaterial));
  const towerCore = new T.Mesh(new T.BoxGeometry(W * 1.5, TOWER_H, W * 1.5), dull(0x23262c)); towerCore.position.set(TOWER_X, GROUND + TOWER_H / 2, TOWER_Z); site.add(towerCore);
  const mast = new T.Mesh(new T.CylinderGeometry(.02, .035, 1, 6), dull(0x9a9da4)); mast.position.set(TOWER_X, GROUND + TOWER_H + .5, TOWER_Z); site.add(mast);
  for (const y of [1.5, 3.25]) { const arm = new T.Mesh(new T.BoxGeometry(1.25, .07, .1), dull(0x7d8088)); arm.position.set(TOWER_X - .75, GROUND + y, TOWER_Z + .35); site.add(arm); }
  const towerLights = [.9, 1.8, 2.7, 3.6, 4.5].map(y => { const lamp = glowSprite(0xfff0cf, .34); lamp.position.set(TOWER_X - W, GROUND + y, TOWER_Z + W); site.add(lamp); return lamp; });
  const warning = glowSprite(0xff3a30, .6); warning.position.set(TOWER_X, GROUND + TOWER_H + 1, TOWER_Z); site.add(warning);
  // Xenon searchlight beams crossing behind the vehicle.
  const beamTexture = canvasTexture(64, 256, ctx => {
    const g = ctx.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
    const edge = ctx.createLinearGradient(0, 0, 64, 0); edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(.5, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = edge; ctx.fillRect(0, 0, 64, 256);
  });
  const beams = [[-7, .5], [9.5, -.42], [-3, .24]].map(([x, lean], i) => {
    const beam = new T.Mesh(new T.PlaneGeometry(1, 13).translate(0, 6.5, 0), new T.MeshBasicMaterial({ map: beamTexture, color: 0xbcd0ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    beam.position.set(PAD.x + x, GROUND, PAD.z - 5 - i * 2); beam.rotation.z = -lean; beam.scale.x = 1.5; site.add(beam); return { beam, lean };
  });
  const flood = new T.DirectionalLight(0xdbe6ff, 0); flood.position.set(-6, 3, 9); flood.target = stack; world.add(flood);
  const rim = new T.DirectionalLight(0x9fc4ff, 0); rim.position.set(2, 4, -8); rim.target = stack; world.add(rim);

  // ---- smoke and steam: a pool of soft puffs, in the site's frame
  type Puff = { sprite: T.Sprite; material: T.SpriteMaterial; velocity: T.Vector3; age: number; life: number; from: number; to: number; alpha: number; warm: boolean };
  const puffs: Puff[] = Array.from({ length: 320 }, () => {
    const material = new T.SpriteMaterial({ map: puffTexture, transparent: true, depthWrite: false, fog: false, rotation: random() * 6.28 });
    const sprite = new T.Sprite(material); sprite.visible = false; smoke.add(sprite);
    return { sprite, material, velocity: new T.Vector3(), age: 0, life: 0, from: 1, to: 1, alpha: 0, warm: false };
  });
  let nextPuff = 0;
  const puff = (at: T.Vector3, vx: number, vy: number, vz: number, life: number, from: number, to: number, alpha: number, warm: boolean) => {
    const p = puffs[nextPuff]; nextPuff = (nextPuff + 1) % puffs.length;
    p.sprite.position.copy(at); p.velocity.set(vx, vy, vz); p.age = 0; p.life = life; p.from = from; p.to = to; p.alpha = alpha; p.warm = warm; p.sprite.visible = true;
  };
  const LIT = new T.Color(1, .74, .42), SMOKE = new T.Color(.66, .65, .66), STEAM = new T.Color(.8, .84, .92);

  const sepFlash = glowSprite(0xfff2d8, 1, 0); sepFlash.visible = false; world.add(sepFlash);

  // ---- streaking stars, in the camera's frame: each is a short line from head to tail
  const COUNT = 1400, DEPTH = 150, heads = new Float32Array(COUNT * 3), speeds = new Float32Array(COUNT), lines = new Float32Array(COUNT * 6), tints = new Float32Array(COUNT * 6);
  for (let i = 0; i < COUNT; i++) {
    let x = 0, y = 0;
    // none straight ahead: they would fly out of the ship
    do { x = (random() * 2 - 1) * 70; y = (random() * 2 - 1) * 42; } while (Math.hypot(x, y * 1.5) < 5);
    heads.set([x, y, 6 - random() * DEPTH], i * 3); speeds[i] = 45 + random() * 75;
    const tone = random(), [r, g, b] = tone < .15 ? [.7, .8, 1] : tone < .25 ? [1, .85, .6] : [.95, .93, .86];
    tints.set([r, g, b, r * .05, g * .05, b * .08], i * 6);
  }
  const streakGeometry = new T.BufferGeometry(), streakPositions = new T.BufferAttribute(lines, 3);
  streakGeometry.setAttribute('position', streakPositions); streakGeometry.setAttribute('color', new T.BufferAttribute(tints, 3));
  const streakMaterial = new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  const streaks = new T.LineSegments(streakGeometry, streakMaterial); streaks.frustumCulled = false; rig.add(streaks);

  // ---- galactic haze far behind everything: soft clouds of cold blue and warm gold
  const hazeTexture = canvasTexture(1024, 512, ctx => {
    for (let i = 0; i < 60; i++) {
      // gathered along a tilted band, like a galaxy seen edge-on
      const x = random() * 1024, y = 256 + (x - 512) * .18 + (random() - .5) * 230, r = 60 + random() * 190;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, r), tone = i % 3 === 0 ? '223,194,141' : i % 3 === 1 ? '96,128,168' : '150,112,160';
      cloud.addColorStop(0, `rgba(${tone},${.05 + random() * .09})`); cloud.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = cloud; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 14; i++) {
      const x = 300 + random() * 420, y = 256 + (x - 512) * .18 + (random() - .5) * 40, r = 30 + random() * 70;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
      cloud.addColorStop(0, `rgba(255,236,204,${.05 + random() * .06})`); cloud.addColorStop(1, 'rgba(255,236,204,0)');
      ctx.fillStyle = cloud; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(240,232,214,${random() * .55})`; const s = random() < .05 ? 2 : 1; ctx.fillRect(random() * 1024, random() * 512, s, s); }
  });
  const hazeMaterial = new T.MeshBasicMaterial({ map: hazeTexture, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const haze = new T.Mesh(new T.PlaneGeometry(640, 320), hazeMaterial); haze.position.z = -265; haze.renderOrder = -5; rig.add(haze);

  // ---- the destination: a bright point with a soft halo and four thin rays
  const beaconTexture = canvasTexture(256, 256, ctx => {
    const halo = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    halo.addColorStop(0, 'rgba(255,250,235,1)'); halo.addColorStop(.08, 'rgba(255,236,196,.85)'); halo.addColorStop(.3, 'rgba(223,194,141,.22)'); halo.addColorStop(1, 'rgba(223,194,141,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 256, 256);
    for (const [w, h] of [[256, 3], [3, 256]]) {
      const ray = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      ray.addColorStop(0, 'rgba(255,244,220,.9)'); ray.addColorStop(1, 'rgba(255,244,220,0)');
      ctx.fillStyle = ray; ctx.fillRect(128 - w / 2, 128 - h / 2, w, h);
    }
  });
  const beaconMaterial = new T.SpriteMaterial({ map: beaconTexture, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  const beacon = new T.Sprite(beaconMaterial); beacon.scale.setScalar(9);

  // ---- poses: upright on the pad showing the orbiter three-quarters on; then nose away from
  // the camera, top up, seen from behind
  const qPad = new T.Quaternion().setFromEuler(new T.Euler(0, -.62, 0)), qCruise = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2 + .2, 0, 0));
  const position = new T.Vector3(), scratch = new T.Vector3(), qScratch = new T.Quaternion(), euler = new T.Euler(), down = new T.Vector3();
  const radial3 = new T.Vector3(), along = new T.Vector3(), basis = new T.Matrix4();
  const qWorld = new T.Quaternion();
  let orbit = 0, orbitAngle = .95, warp = 0, hazeLevel = 0, clock = 0, present = 1, dim = 1, steamDue = 0, smokeDue = 0, ventDue = 0, smokeSide = 0;

  return {
    rig, beacon, textures,
    /** 0..1: how far the scene's own sun and fill light should be turned down for the night pad. */
    get dim() { return dim; },
    /**
     * `stage`: where the game is. `arrival`: null on the title; from the start click it is 0 during
     * the launch, then 0..1 while the camera flies in to the worlds. `hidden`: 0..1, how much of the
     * worlds is still out of sight (the beacon stands in for them). `launch`: seconds since the click.
     */
    update(dt: number, stage: string, arrival: number | null, hidden: number, still: boolean, launch = 0) {
      clock += dt;
      const flying = arrival !== null, idle = stage === 'title' && !flying;
      const t = flying ? Math.min(launch, LAUNCH_SECONDS) : 0, a = arrival ?? 0;
      // Once the orbiter has jumped, the pad is gone for good: it only returns with the title.
      present = flying ? (a < .4 ? 1 : 0) : present + ((idle ? 1 : 0) - present) * (1 - Math.exp(-5 * dt));

      // The climb, staged: height above the pad, how far the camera has risen after it, and its tilt.
      const rise = Math.max(0, t - T_SRB), height = 1.7 * rise ** 2 + .6 * rise ** 4;
      const lead = 1.3 * (1 - Math.exp(-height / 1.3)), cameraHeight = height - lead;
      const space = smoothstep(t, 2.7, 3.9), turn = smoothstep(t, 2.5, 5.7);
      const mainPower = flying ? smoothstep(t, .15, .7) : 0;
      const boosterPower = flying ? smoothstep(t, T_SRB - .05, T_SRB + .12) * (1 - smoothstep(t, T_SRB_SEP - .45, T_SRB_SEP)) : 0;
      // The camera tilts up after the shuttle: the ground sinks while the shuttle holds its place on screen.
      const tilt = .3 * smoothstep(t, 1.4, 2.6) * (1 - smoothstep(t, 3.6, 4.8));
      world.rotation.x = LOOK_DOWN * (1 - space) - tilt;
      const rumble = still || a > 0 ? 0 : (.012 * mainPower + .05 * boosterPower) * Math.exp(-height / 14);
      world.position.set(Math.sin(clock * 83) * rumble, Math.sin(clock * 67 + 1) * rumble, 0);
      site.position.y = smoke.position.y = -cameraHeight;
      dim = present * (1 - smoothstep(t, 2.8, 4.6));

      // The launch site fades into the dark as the sky opens out.
      const siteLevel = present * (1 - space);
      site.visible = far.visible = siteLevel > .01;
      if (site.visible) {
        far.position.y = -cameraHeight * .12; skyMaterial.opacity = siteLevel; solids.forEach(m => { m.opacity = siteLevel; }); townMaterial.opacity = siteLevel; (crawlerway.material as T.MeshBasicMaterial).opacity = siteLevel;
        clouds.forEach(({ material, level }) => { material.opacity = level * siteLevel; }); lampGlows.forEach((lamp, i) => { (lamp.material as T.SpriteMaterial).opacity = siteLevel * (i % 7 === 6 ? .45 : 1); }); groundMaterial.opacity = siteLevel; latticeMaterial.opacity = siteLevel;
        floodPool.opacity = siteLevel * .5; firePool.opacity = siteLevel * Math.min(1, boosterPower + mainPower * .12) * Math.exp(-height / 7);
        const blink = (clock % 1.4) < .7 ? 1 : .15;
        (warning.material as T.SpriteMaterial).opacity = siteLevel * blink;
        towerLights.forEach((lamp, i) => { (lamp.material as T.SpriteMaterial).opacity = siteLevel * (.8 + .2 * Math.sin(clock * 9 + i * 2)); });
        beams.forEach(({ beam, lean }, i) => { beam.rotation.z = -lean + (still ? 0 : Math.sin(clock * .25 + i * 2.1) * .07); (beam.material as T.MeshBasicMaterial).opacity = siteLevel * .2; });
      }
      flood.intensity = 2.6 * siteLevel; fire.intensity = flying && a < .4 ? 28 * boosterPower + 2.5 * mainPower : 0;

      // Star speed: none on the pad, building through the climb, braking as the worlds come up.
      const goal = !flying ? (stage === 'worlds' ? .03 : 0) : a > 0 ? lerp(1, .03, smoothstep(a, .05, .7)) : smoothstep(t, 1.9, 4.4);
      warp = flying ? goal : warp + (goal - warp) * (1 - Math.exp(-2.5 * dt));
      streaks.visible = warp > .002; streakMaterial.opacity = Math.min(1, warp * 12);
      // Going up, the stars fall past; as the shuttle turns downrange they swing round to rush by.
      streaks.rotation.x = flying ? Math.PI / 2 * (1 - turn) : 0;
      if (streaks.visible) {
        const moving = still ? 0 : warp;
        for (let i = 0; i < COUNT; i++) {
          let z = heads[i * 3 + 2] + speeds[i] * moving * dt; if (z > 6) z -= DEPTH; heads[i * 3 + 2] = z;
          const x = heads[i * 3], y = heads[i * 3 + 1], tail = Math.max(.05, speeds[i] * warp * .06);
          lines.set([x, y, z, x, y, z - tail], i * 6);
        }
        streakPositions.needsUpdate = true;
      }
      const hazeGoal = stage === 'title' ? 1 : stage === 'worlds' ? .5 : 0;
      hazeLevel += (hazeGoal - hazeLevel) * (1 - Math.exp(-1.8 * dt));
      haze.visible = hazeLevel > .01; hazeMaterial.opacity = hazeLevel * .9;
      beaconMaterial.opacity = hidden; beacon.visible = hidden > .01;
      beacon.scale.setScalar(9 * (1 + .06 * Math.sin(clock * 2.3)) * (1 + a * 2));
      beaconMaterial.rotation = clock * .05;

      // The vehicle: on the pad, up, and over onto its back to be seen from behind.
      const sway = still ? 0 : turn;
      stack.visible = flying || present > .5;
      position.copy(PAD).setY(PAD.y + lead + Math.tan(tilt) * -PAD.z * .85).lerp(scratch.set(Math.sin(clock * .55) * .7 * sway, .5 + Math.sin(clock * .9) * .1 * sway, -9), smoothstep(t, 2.6, 5.9));
      stack.position.copy(position);
      qScratch.setFromEuler(euler.set(0, 0, -Math.cos(clock * .55) * .2 * sway));
      stack.quaternion.copy(qPad).slerp(qCruise, turn).premultiply(qScratch);
      // A slow roll on the way up, like the real roll programme.
      stack.rotateY(-1.1 * smoothstep(t, 1.5, 3.4) * (1 - turn));

      // Separation: the boosters peel off sideways and fall behind; later the tank drops away.
      const sinceBoosters = t - T_SRB_SEP, sinceTank = t - T_TANK_SEP + a * 4.8;
      boosters.forEach(({ group, side, glow }) => {
        const s = Math.max(0, sinceBoosters);
        group.visible = s < 1.7; group.position.set(side * (6.3 + 5 * s + 12 * s * s), -34 * s * s, -7 * s);
        group.rotation.set(.35 * s, 0, -side * .55 * s); group.scale.setScalar(1 - smoothstep(s, 1.1, 1.7));
        glow.scale.setScalar(26 * (1 + .1 * Math.sin(clock * 37 + side))); (glow.material as T.SpriteMaterial).opacity = boosterPower * .9;
      });
      const drop = Math.max(0, sinceTank);
      tank.visible = drop < 1.7; tank.position.set(0, -26 * drop * drop, -9 * drop - 6 * drop * drop); tank.rotation.x = .22 * drop; tank.scale.setScalar(1 - smoothstep(drop, 1.2, 1.7));
      const pop = Math.exp(-(((sinceBoosters - .05) / .09) ** 2)) + .6 * Math.exp(-(((sinceTank - .05) / .09) ** 2));
      sepFlash.visible = flying && pop > .02;
      if (sepFlash.visible) { sepFlash.position.copy(stack.position); sepFlash.scale.setScalar(7 * pop); (sepFlash.material as T.SpriteMaterial).opacity = pop * .8; }

      // The orbiter never leaves the frame: as the camera flies in to the worlds it pulls ahead in
      // one long curve and settles into a slow orbit of Earth, nose along its path, payload bay
      // to the stars. It stays there on the world screen.
      orbit = flying ? 1 : orbit + ((stage === 'worlds' ? 1 : 0) - orbit) * (1 - Math.exp(-4 * dt));
      if (flying && a === 0) orbitAngle = .75;
      const settle = flying ? smootherstep(a, .04, .96) : 1;
      if (settle > 0 && orbit > .01) {
        if (!still) orbitAngle += dt * .2;
        radial3.copy(ORBIT_U).multiplyScalar(Math.cos(orbitAngle)).addScaledVector(ORBIT_V, Math.sin(orbitAngle));
        along.copy(ORBIT_U).multiplyScalar(-Math.sin(orbitAngle)).addScaledVector(ORBIT_V, Math.cos(orbitAngle));
        world.updateWorldMatrix(true, false);
        world.worldToLocal(position.copy(EARTH_CENTRE).addScaledVector(radial3, ORBIT_RADIUS));
        // a gentle sideways arc, so the path curves in instead of running straight down the view
        const arc = Math.sin(Math.PI * settle);
        stack.position.lerp(position, settle); stack.position.x += arc * 1.1; stack.position.y += arc * .5;
        qScratch.setFromRotationMatrix(basis.makeBasis(scratch.crossVectors(along, radial3), along, radial3)).premultiply(world.getWorldQuaternion(qWorld).invert());
        stack.quaternion.slerp(qScratch, settle);
        // shrinking by a constant ratio reads as steady distance, not a sudden drop in size
        stack.scale.setScalar(S * Math.pow(ORBIT_SCALE / S, settle) * orbit);
        stack.visible = true;
        if (!flying) { tank.visible = false; boosters.forEach(({ group }) => { group.visible = false; }); }
      } else stack.scale.setScalar(S);

      // Engines: blue-white mains, then the boosters' wall of fire; a hard burn for the jump.
      const throttle = mainPower * (1 - smoothstep(a, .35, .7));
      flames.forEach(({ mesh, material, length, booster }, i) => {
        const power = booster ? boosterPower : throttle, flicker = 1 + Math.sin(clock * 31 + i * 2) * .1 + Math.sin(clock * 53 + i) * .05;
        mesh.visible = power > .01; mesh.scale.set(1, length * flicker * (booster ? .35 + .65 * power : .5 + .5 * Math.min(power, 1)), 1);
        material.uniforms.time.value = clock; material.uniforms.power.value = Math.min(power, 2.2);
      });
      throats.forEach(({ mesh, booster }) => { mesh.visible = (booster ? boosterPower : Math.min(mainPower, throttle)) > .05; });
      mainGlow.scale.setScalar(9 * (1 + .08 * Math.sin(clock * 40))); (mainGlow.material as T.SpriteMaterial).opacity = Math.min(1, throttle) * .7;
      rim.intensity = flying ? 1.6 * smoothstep(t, 3, 4.6) * (1 - settle) : 0;

      // Smoke and steam.
      world.updateMatrixWorld(true);
      const spawn = !still && present > .5;
      if (spawn && idle && (ventDue -= dt) < 0) {
        // Oxygen venting from the tank's tip, and mist creeping over the pad.
        ventDue = .3; puff(scratch.set(PAD.x - .25, GROUND + .34 + 51.5 * S, PAD.z + .2), .45 + random() * .3, .06, 0, 3.2, .2, 1.2, .26, false);
        puff(scratch.set(PAD.x + (random() - .5) * 4, GROUND + .15, PAD.z + (random() - .5) * 2), (random() - .5) * .5, .04, 0, 4.5, .7, 2.2, .1, false);
      }
      if (spawn && flying && a === 0) {
        // Main-engine start: steam blasts out sideways from under the platform.
        if (t > .2 && t < 1.6) for (steamDue += dt * 55; steamDue > 1; steamDue--) {
          const side = random() < .5 ? -1 : 1;
          puff(scratch.set(PAD.x + side * 1.2, GROUND + .2, PAD.z + (random() - .5)), side * (3 + random() * 3.5), .3 + random() * 1.1, (random() - .5) * 1.5, 2 + random(), .5, 3.2, .5, false);
        }
        if (boosterPower > .05) for (smokeDue += dt * 120; smokeDue > 1; smokeDue--) {
          smoke.worldToLocal(boosters[smokeSide ^= 1].group.localToWorld(scratch.set(0, -6, 0))); down.set(0, -1, 0).applyQuaternion(stack.quaternion);
          if (height < 3.2) {
            // Off the pad: the exhaust hits the ground and rolls outwards in a lit, boiling cloud.
            const angle = random() * 6.28, speed = 2.5 + random() * 4.5;
            puff(scratch.setY(GROUND + .25 + random() * .4), Math.cos(angle) * speed, .3 + random() * 1.4, Math.sin(angle) * speed * .5, 2.6 + random(), .9, 5.4, .8, true);
          } else puff(scratch, down.x * 2.5 + (random() - .5) * .8, down.y * 2.5 + (random() - .5) * .8, down.z * 2.5 + (random() - .5) * .8, 2 + random() * .9, .5, 2.7, .6, true);
        }
      }
      const fade = present * (flying ? 1 - smoothstep(t, 4.4, 5.4) : 1), drag = Math.exp(-1.5 * dt);
      for (const p of puffs) {
        if (!p.sprite.visible) continue;
        p.age += dt; const k = p.age / p.life;
        if (k >= 1 || fade < .01) { p.sprite.visible = false; continue; }
        p.sprite.position.addScaledVector(p.velocity, dt); p.velocity.multiplyScalar(drag); if (p.sprite.position.y < GROUND + .1) p.sprite.position.y = GROUND + .1;
        p.sprite.scale.setScalar(lerp(p.from, p.to, 1 - (1 - k) ** 2));
        p.material.opacity = p.alpha * fade * Math.min(1, k * 10) * (1 - k) ** 1.4;
        if (p.warm) p.material.color.copy(LIT).lerp(SMOKE, Math.min(1, p.age / .55)).multiplyScalar(.75 + .5 * boosterPower);
        else p.material.color.copy(STEAM).multiplyScalar(.75 + .4 * Math.min(1, mainPower + boosterPower));
      }

    },
  };
}
