/**
 * Mount one decorative Larry per page. Load larry.css alongside this module.
 * @param {{ mode?: 'companion' | 'cameo' | 'greeter' | 'inspector' | 'reactions' | 'task-buddy' | 'lookout' | 'easter-egg', duration?: number,
 *   assetBase?: string | URL, anchor?: Element | null,
 *   dialog?: HTMLDialogElement | null, hoverTargets?: string | null, trigger?: Element | null }} options
 */
export function mountLarry({
  mode = 'companion',
  duration = 6000,
  assetBase = new URL('./assets/', import.meta.url),
  anchor = null,
  dialog: readme = null,
  hoverTargets = null,
  trigger = null,
} = {}) {
  if (!['companion', 'cameo', 'greeter', 'inspector', 'reactions', 'task-buddy', 'lookout', 'easter-egg'].includes(mode)) throw new RangeError('Unknown Larry mode.');
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Larry duration must be positive milliseconds.');
  if (hoverTargets) document.querySelector(hoverTargets);
  if (mode === 'inspector' && (!readme || readme.tagName !== 'DIALOG')) throw new TypeError('Inspector needs a dialog element.');
  if (document.querySelector('#pet-layer')) throw new Error('Larry is already mounted.');
  const assets = new URL(assetBase, document.baseURI);
  const asset = name => new URL(name, assets).href;
  const events = new AbortController();
  const on = (element, type, listener, options = {}) =>
    element.addEventListener(type, listener, { ...options, signal: events.signal });
  const layer = document.createElement('div');
  layer.id = 'pet-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<button id="larry" type="button" tabindex="-1" aria-hidden="true">
    <img width="192" height="208" alt="" draggable="false">
    <canvas width="108" height="117" aria-hidden="true" hidden></canvas>
  </button><span id="pet-bubble" aria-hidden="true" hidden></span>`;
  document.body.append(layer);
  const pet = layer.querySelector('#larry');
  const bubble = layer.querySelector('#pet-bubble');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const image = pet.querySelector('img');
  const canvas = pet.querySelector('canvas');
  const painter = canvas.getContext('2d');
  pet.dataset.mode = mode;
  const poster = asset('larry-still.png');
  let waveFailed = false;
  function setWave(animated = true) {
    const source = !animated || reduced.matches || document.hidden || waveFailed ? poster : asset('larry.webp');
    if (image.src !== source) image.src = source;
  }
  function fallback() {
    if (image.src !== poster) { waveFailed = true; image.src = poster; return true; }
    pet.dataset.artworkFailed = 'true'; return false;
  }
  if (mode !== 'companion') {
    let active = false, sticky = false, state = 'idle', animated = true;
    let timer, hoverTimer, effect = 0, destroyed = false, hovered = null;
    let footer = null, observer = null, extra = null, extraReady = false;
    const reacting = ['idle', 'working', 'waiting', 'success', 'attention'];
    layer.hidden = true;
    pet.dataset.eaten = '0'; pet.dataset.state = 'idle';
    function paint() {
      setWave(animated);
      canvas.hidden = true; image.hidden = false;
      if (extraReady && painter && ['working', 'waiting'].includes(state)) {
        painter.clearRect(0, 0, 108, 117);
        painter.drawImage(extra, 3 * 108, 117, 108, 117, 0, 0, 108, 117);
        delete canvas.dataset.artwork;
        canvas.hidden = false; image.hidden = true;
      }
    }
    function place() {
      if (footer && pet.parentElement === footer) return;
      const title = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      const x = title ? title.right + 12 : innerWidth - pet.offsetWidth - 16;
      const y = title ? title.bottom - pet.offsetHeight : innerHeight - pet.offsetHeight - 16;
      pet.style.transform = `translate3d(${Math.max(0, Math.min(innerWidth - pet.offsetWidth, x))}px,${Math.max(0, Math.min(innerHeight - pet.offsetHeight - 8, y))}px,0) translateY(var(--larry-hop,0px))`;
    }
    function cancelEffect() { cancelAnimationFrame(effect); effect = 0; pet.style.removeProperty('--larry-hop'); }
    function hide() {
      active = false; clearTimeout(timer); clearTimeout(hoverTimer); cancelEffect();
      hovered = null; layer.hidden = true;
      if (footer) { footer.hidden = true; layer.append(pet, bubble); pet.disabled = false; }
      if (!destroyed) setWave(false);
    }
    function reveal(persistent = false) {
      if (destroyed) return;
      if (document.hidden) { hide(); return; }
      active = true; sticky = persistent; clearTimeout(timer); paint();
      if (!image.complete || !image.naturalWidth) return;
      if (mode === 'inspector') {
        if (!readme.open) { hide(); return; }
        footer.hidden = false; footer.append(pet, bubble); pet.disabled = true;
        layer.hidden = true;
      } else { layer.hidden = false; place(); }
      if (!persistent) timer = setTimeout(hide, duration);
    }
    function show() { animated = true; state = 'idle'; pet.dataset.state = state; reveal(false); }
    function loadExtra() {
      if (extra) return;
      extra = new Image();
      on(extra, 'load', () => { extraReady = true; if (active) paint(); });
      extra.src = asset('larry-extra-strip.webp');
    }
    function react(next) {
      if (!reacting.includes(next)) throw new RangeError('Unknown Larry reaction.');
      if (destroyed) return;
      cancelEffect(); state = next; pet.dataset.state = state;
      if (next === 'idle') { hide(); return; }
      animated = next === 'attention';
      if (next === 'working' || next === 'waiting') loadExtra();
      reveal(next !== 'success');
      if (next === 'success' && active && !reduced.matches) {
        let started;
        function hop(time) {
          if (started === undefined) started = time;
          const progress = Math.min(1, (time - started) / 650);
          pet.style.setProperty('--larry-hop', `${-6 * Math.sin(Math.PI * progress)}px`);
          if (progress < 1 && active && !document.hidden && !reduced.matches) effect = requestAnimationFrame(hop);
          else cancelEffect();
        }
        effect = requestAnimationFrame(hop);
      }
    }
    on(image, 'load', () => { if (active) reveal(sticky); });
    on(image, 'error', () => { if (!fallback()) hide(); });
    on(reduced, 'change', () => { cancelEffect(); paint(); });
    on(window, 'resize', () => { if (active) place(); });
    on(document, 'visibilitychange', () => { if (document.hidden) hide(); });
    if (mode === 'inspector') {
      footer = document.createElement('div'); footer.className = 'larry-inspection';
      footer.setAttribute('aria-hidden', 'true'); footer.hidden = true; readme.append(footer);
      const inspect = () => { animated = false; if (readme.open) reveal(true); else hide(); };
      observer = new MutationObserver(inspect);
      observer.observe(readme, { attributes: true, attributeFilter: ['open'] });
      on(readme, 'close', hide);
      if (readme.open) inspect();
    }
    if (mode === 'reactions' && hoverTargets) {
      const enter = (event, delay) => {
        const target = event.target instanceof Element ? event.target.closest(hoverTargets) : null;
        if (!target || target === hovered) return;
        clearTimeout(hoverTimer); hovered = target;
        hoverTimer = setTimeout(() => { if (hovered === target) { animated = true; state = 'idle'; pet.dataset.state = state; reveal(false); } }, delay);
      };
      on(document, 'pointerover', event => { if (event.pointerType === 'mouse') enter(event, 350); });
      on(document, 'focusin', event => enter(event, 0));
      const leave = event => { if (hovered && !hovered.contains(event.relatedTarget)) { hovered = null; clearTimeout(hoverTimer); } };
      on(document, 'pointerout', leave); on(document, 'focusout', leave);
    }
    if (mode === 'easter-egg' && trigger) on(trigger, 'click', show);
    if (mode === 'greeter') show();
    else if (mode === 'lookout') { animated = false; reveal(true); }
    else setWave(false);
    return Object.freeze({
      show, hide, react,
      destroy() {
        if (destroyed) return;
        destroyed = true; hide(); events.abort(); observer?.disconnect();
        image.removeAttribute('src'); extra?.removeAttribute('src'); footer?.remove(); layer.remove();
      },
    });
  }
  let petWidth = pet.offsetWidth, petHeight = pet.offsetHeight, lastSpritePaint = -Infinity;
  let bubbleSize = { width: 180, height: 28 };
  const runs = new Image();
  const looks = new Image();
  const extras = new Image();
  const inspection = document.createElement('div');
  inspection.className = 'larry-inspection'; inspection.setAttribute('aria-hidden', 'true'); inspection.hidden = true; readme?.append(inspection);
  let extraReady = false, sleepy = false, inspecting = false, hopFrame = 0, blinkFrame = 0;
  let lastBlink = -Infinity, hoverFolder = null, hoverTimer, lastFolderReaction = -Infinity;
  let lastActivity = Date.now(), lastSpeech = -Infinity, lastCaption = '', nearby = false;
  let watchSince = 0, directionChanges = 0, reroutes = [], tripLength = 0;
  const captions = {
    first: ['Oh. You brought snacks.', 'A promising start.', 'You may stay.', 'Finally, someone useful.',
      "You have my attention.", "A snack. Sensible choice.", "At last, a useful click.", "You came prepared."],
    treat: ['We can keep doing this.', 'This is an excellent arrangement.', 'Your service has been noted.',
      'Acceptable. Continue.', 'I could get used to this.', 'You understand your role.',
      "Keep those coming.", "That will do nicely.", "You are learning.", "A satisfactory contribution.", "The arrangement stands.", "I accept your offering."],
    reroute: ['I was going that way.', 'We had a plan.', 'You moved it. I saw.', 'This better be the last stop.',
      "Apparently we are doing this instead.", "Do we have a destination?", "I had already committed to that direction.", "You changed the terms."],
    impatient: ['Pick a spot, human.', 'The snack should stay put.', 'I am not your cursor.', 'Make a decision.',
      "I would like one final answer.", "This is a snack, not a negotiation.", "The itinerary needs work.", "I can wait. I will complain."],
    near: ['Yes?', 'Personal space, human.', 'Can I help you?', 'You are very close.', 'The ears are decorative.',
      "There is a whole page over there.", "You may admire from a distance.", "I am aware of you.", "Was there a snack-related question?"],
    watching: ['Very suspicious.', 'I am keeping an eye on that.', 'What exactly are you doing?', 'I saw that.',
      "Interesting choice.", "I have questions.", "That seems unnecessary.", "I am recording this mentally."],
    long: ["Delivery would've been nice.", 'That was an unreasonable distance.', 'Next time, bring it here.', 'I expect a tip.',
      "That was several unnecessary steps.", "This counts as exercise. I object.", "The service here is inconsistent.", "I was comfortable over there."],
    inspect: ['I approved none of this.', 'I see no mention of dinner.', 'Too many words. Not enough snacks.',
      'I will be leaving comments.', 'This needs more cats.',
      "I have several notes.", "The snack policy is unclear.", "Who signed off on this?", "I will need a larger font.", "Where is the nap schedule?"],
    sleepy: ['Wake me for snacks.', 'My shift is over.', 'I am resting my opinions.', 'This meeting could have been a nap.',
      "I have done enough for today.", "Please respect office hours.", "You can take it from here.", "I will supervise from here."],
    sleepyAside: ['Still off duty.', 'Please hold. I am unavailable.', 'The nap is going well.', 'I can judge you with my eyes closed.',
      "I remain unavailable.", "Nothing requires my attention.", "The office is closed.", "I will get back to you after this nap."],
    idle: ['I live here. You are visiting.', 'Everything appears to be under my control.', 'I have no updates.',
      'This is my good side. They all are.', 'I am supervising.', 'Someone has to keep this place running.',
      "I am expecting nothing and still judging.", "My responsibilities are mostly ceremonial.", "You may continue under supervision.", "The page is behaving. For now.", "I see no reason to move.", "I have chosen this spot."],
    morning: ['You are up early. Is there food?', 'Breakfast is a perfectly good reason to be awake.', 'I have been waiting for breakfast.',
      "The breakfast department is behind schedule.", "I see you are awake. Convenient.", "A morning without snacks is just waiting.", "My day starts when the food arrives.", "I have already checked the bowl."],
    late: ['Some of us are trying to sleep.', 'This is an odd hour for a visit.', 'If you are awake, you could feed me.',
      "The night shift requires snacks.", "We could both be doing less.", "I assume this is important.", "You are cutting into my nap schedule.", "I was having a perfectly good evening."],
    folder: ["Where do you think you are going?", "That folder has been inspected.", "I would check for snacks first.", "You may browse. I will supervise.", "Suspicious amount of hovering.", "Take your time. I have opinions.", "I know what is in there. Mostly.", "Proceed under feline supervision.", "Do let me know if you find dinner.", "I have already claimed that folder."],
    approval: ["That earned a slow blink.", "You may consider that approval.", "A rare favorable review.", "I am briefly pleased.", "You have done adequately.", "I will allow it.", "No complaints. For the moment.", "You saw nothing.", "My opinion of you has improved slightly.", "A small gesture of professional respect."],
  };
  const captionBags = {};
  const recentCaptions = [];
  const asideDelay = () => 45000 + Math.random() * 45000;
  let nextAside = Date.now() + asideDelay();
  function speak(kind, required = false) {
    if (!required && Date.now() - lastSpeech < 9000) return false;
    if (!captionBags[kind]?.length) {
      const bag = [...captions[kind]];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      captionBags[kind] = bag;
    }
    const bag = captionBags[kind];
    let index = bag.findIndex(text => !recentCaptions.includes(text));
    if (index < 0) index = bag.findIndex(text => text !== lastCaption);
    if (index < 0) return false;
    const [chosen] = bag.splice(index, 1);
    recentCaptions.push(chosen); if (recentCaptions.length > 12) recentCaptions.shift();
    lastSpeech = Date.now(); lastCaption = chosen;
    say(chosen); return true;
  }
  function paintExtra(row, column, state) {
    if (!extraReady || !painter) return false;
    delete canvas.dataset.artwork;
    painter.clearRect(0, 0, 108, 117);
    painter.drawImage(extras, column * 108, row * 117, 108, 117, 0, 0, 108, 117);
    image.hidden = true; canvas.hidden = false; pet.dataset.state = state;
    delete pet.dataset.lookDirection; lookDirection = null;
    return true;
  }
  function cancelHop() {
    cancelAnimationFrame(hopFrame); hopFrame = 0; pet.style.removeProperty('--larry-hop');
  }
  function tinyHop() {
    if (reduced.matches || !extraReady || !painter || inspecting || target) return;
    let started;
    function tick(time) {
      if (started === undefined) started = time;
      const elapsed = time - started;
      if (elapsed >= 650 || reduced.matches || target || inspecting) { cancelHop(); rest(); return; }
      paintExtra(0, Math.min(4, Math.floor(elapsed / 130)), 'hopping');
      pet.style.setProperty('--larry-hop', `${-8 * Math.sin(Math.PI * elapsed / 650)}px`);
      hopFrame = requestAnimationFrame(tick);
    }
    hopFrame = requestAnimationFrame(tick);
  }
  function cancelBlink() { cancelAnimationFrame(blinkFrame); blinkFrame = 0; }
  function slowBlink() {
    let started;
    lastBlink = Date.now();
    function tick(time) {
      if (started === undefined) started = time;
      const elapsed = time - started;
      if (elapsed >= 900 || reduced.matches || target || inspecting || document.hidden) { cancelBlink(); rest(); return; }
      paintExtra(1, elapsed >= 100 && elapsed < 650 ? 3 : 0, 'blinking');
      blinkFrame = requestAnimationFrame(tick);
    }
    blinkFrame = requestAnimationFrame(tick);
  }
  function watchFolder(element) {
    const folder = hoverTargets && element instanceof Element ? element.closest(hoverTargets) : null;
    if (folder === hoverFolder) return;
    clearTimeout(hoverTimer); hoverFolder = folder;
    if (!folder || target || inspecting || hopFrame || blinkFrame) return;
    hoverTimer = setTimeout(() => {
      if (hoverFolder === folder && !document.hidden && !target && !inspecting && !hopFrame && !blinkFrame &&
          Date.now() - lastFolderReaction >= 25000 && Math.random() < .65 && speak('folder', false)) {
        lastFolderReaction = Date.now();
      }
    }, 650 + Math.random() * 700);
  }
  function activity() {
    lastActivity = Date.now();
    if (sleepy) { sleepy = false; if (!target) rest(); }
  }
  let lookReady = false, pointer = null, lookFrame = 0, lookDirection = null;
  let ready = false, facing = 0, distanceWalked = 0;
  function lookAtPointer() {
    if (!pointer || !lookReady || !painter || reduced.matches || target || inspecting || sleepy || hopFrame || blinkFrame) return false;
    const dx = pointer.x - (x + petWidth / 2);
    const dy = pointer.y - (y + petHeight * .28);
    if (Math.hypot(dx, dy) < 24) { lookDirection = null; delete pet.dataset.lookDirection; return false; }
    const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    const direction = Math.round(angle / (Math.PI * 2) * 16) % 16;
    if (lookDirection !== null && direction !== lookDirection) {
      const center = lookDirection * Math.PI * 2 / 16;
      const difference = Math.abs(Math.atan2(Math.sin(angle - center), Math.cos(angle - center)));
      if (difference < Math.PI * 2 / 16 * .65) return true;
    }
    if (lookDirection === direction && !canvas.hidden && pet.dataset.state === 'idle') return true;
    if (lookDirection !== direction) directionChanges++;
    lookDirection = direction;
    delete canvas.dataset.artwork;
    painter.clearRect(0, 0, 108, 117);
    painter.drawImage(looks, (direction % 8) * 108, Math.floor(direction / 8) * 117, 108, 117, 0, 0, 108, 117);
    image.hidden = true; canvas.hidden = false;
    pet.dataset.lookDirection = String(direction);
    return true;
  }
  function rest() {
    if (hopFrame || blinkFrame) return;
    if (inspecting) {
      if (lookReady && painter) {
        delete canvas.dataset.artwork;
        painter.clearRect(0, 0, 108, 117); painter.drawImage(looks, 0, 0, 108, 117, 0, 0, 108, 117);
        image.hidden = true; canvas.hidden = false;
      }
      pet.dataset.state = 'inspecting'; delete pet.dataset.lookDirection; return;
    }
    if (sleepy && paintExtra(1, 3, 'sleepy')) return;
    pet.dataset.state = 'idle';
    if (lookAtPointer()) return;
    lookDirection = null; delete pet.dataset.lookDirection;
    setWave();
    if (reduced.matches && painter && image.complete && image.naturalWidth) {
      painter.clearRect(0, 0, 108, 117); painter.drawImage(image, 0, 0, 108, 117);
      canvas.dataset.artwork = 'wave';
      canvas.hidden = false; image.hidden = true;
    } else { canvas.hidden = true; image.hidden = false; }
  }
  function walk(dx, distance, time) {
    if (!ready || !painter) return;
    lookDirection = null; delete pet.dataset.lookDirection;
    if (Math.abs(dx) > .5) facing = dx < 0 ? 1 : 0;
    distanceWalked += distance;
    const frame = Math.floor(distanceWalked / (20 * petWidth / 108)) % 8;
    if (time - lastSpritePaint < 50 || (pet.dataset.state === 'walking' && pet.dataset.frame === String(frame) && pet.dataset.facing === (facing ? 'left' : 'right'))) return;
    lastSpritePaint = time;
    delete canvas.dataset.artwork;
    painter.clearRect(0, 0, 108, 117);
    painter.drawImage(runs, frame * 108, facing * 117, 108, 117, 0, 0, 108, 117);
    image.hidden = true; canvas.hidden = false;
    pet.dataset.state = 'walking'; pet.dataset.facing = facing ? 'left' : 'right'; pet.dataset.frame = String(frame);
  }
  on(runs, 'load', () => { ready = true; pet.dataset.walkReady = 'true'; });
  on(runs, 'error', () => { pet.dataset.walkReady = 'failed'; });
  runs.src = asset('larry-run-strip.webp');
  on(looks, 'load', () => { lookReady = true; pet.dataset.lookReady = 'true'; if (!target) rest(); });
  on(looks, 'error', () => { pet.dataset.lookReady = 'failed'; });
  looks.src = asset('larry-look-strip.webp');
  on(extras, 'load', () => { extraReady = true; pet.dataset.extraReady = 'true'; });
  on(extras, 'error', () => { pet.dataset.extraReady = 'failed'; });
  extras.src = asset('larry-extra-strip.webp');
  on(image, 'load', () => { if (!target) rest(); });
  on(image, 'error', fallback);
  setWave();
  on(reduced, 'change', () => { cancelBlink(); if (!target) rest(); });
  let x = 0, y = 0, target = null, frame = 0, lastTime = 0;
  let eaten = 0, bubbleTimer, rerouteTimer, perched = true;
  on(document, 'pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    activity(); pointer = { x: event.clientX, y: event.clientY }; watchFolder(event.target);
    if (target || reduced.matches || hopFrame || blinkFrame || inspecting) return;
    const distance = Math.hypot(pointer.x - x - petWidth / 2, pointer.y - y - petHeight * .28);
    if (distance < 38 && !nearby) { nearby = true; speak('near'); }
    if (distance > 55) nearby = false;
    if (!watchSince) watchSince = Date.now();
    if (Date.now() - watchSince > 12000 && directionChanges >= 6) { speak('watching'); watchSince = Date.now(); directionChanges = 0; }
    if (lookFrame) return;
    lookFrame = requestAnimationFrame(() => { lookFrame = 0; if (!target) rest(); });
  });
  function forgetPointer() {
    clearTimeout(hoverTimer); hoverFolder = null; pointer = null; nearby = false; watchSince = 0; directionChanges = 0; cancelAnimationFrame(lookFrame); lookFrame = 0;
    if (!target) rest();
  }
  on(document.documentElement, 'pointerleave', forgetPointer);
  on(window, 'blur', forgetPointer);
  const limits = () => ({ x: Math.max(0, innerWidth - petWidth), y: Math.max(0, innerHeight - petHeight - 8) });
  function move(nx, ny) {
    const max = limits();
    x = Math.max(0, Math.min(max.x, nx));
    y = Math.max(0, Math.min(max.y, ny));
    pet.style.transform = `translate3d(${x}px,${y}px,0) translateY(var(--larry-hop,0px))`;
    positionBubble();
  }
  function positionBubble() {
    if (bubble.hidden) return;
    const { width, height } = bubbleSize;
    bubble.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, x - 20))}px`;
    const above = y - height - 8;
    const top = above >= 8 ? above : y + petHeight + 8;
    bubble.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, top))}px`;
  }
  function say(text) {
    clearTimeout(bubbleTimer); bubble.textContent = text; bubble.hidden = false;
    bubbleSize = bubble.getBoundingClientRect();
    positionBubble();
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, Math.max(2400, Math.min(4200, text.length * 55)));
  }
  function stopSnack() {
    cancelAnimationFrame(frame); clearTimeout(rerouteTimer); frame = 0; lastTime = 0;
    target?.element.remove(); target = null; rest();
  }
  function eat() {
    stopSnack(); eaten++;
    pet.dataset.eaten = String(eaten);
    const approving = eaten > 1 && eaten % 3 !== 0 && !reduced.matches && extraReady && painter &&
      Date.now() - lastBlink >= 20000 && Math.random() < .2;
    speak(eaten === 1 ? 'first' : approving ? 'approval' : tripLength > 650 ? 'long' : 'treat',
      true);
    if (approving) slowBlink();
    if (eaten % 3 === 0) tinyHop();
  }
  function pursue(time) {
    if (!target || document.hidden) return;
    const dx = target.x - x, dy = target.y - y, distance = Math.hypot(dx, dy);
    const step = Math.min(32, lastTime ? time - lastTime : 16) * .24 * petWidth / 108;
    lastTime = time;
    if (distance <= step || reduced.matches) { move(target.x, target.y); eat(); return; }
    walk(dx, step, time);
    move(x + dx / distance * step, y + dy / distance * step);
    frame = requestAnimationFrame(pursue);
  }
  function snack(px, py) {
    const redirected = !!target;
    activity(); cancelHop(); cancelBlink();
    if (redirected) reroutes.push(Date.now());
    reroutes = reroutes.filter(time => Date.now() - time < 6000);
    perched = false;
    stopSnack();
    const max = limits();
    const sx = Math.max(12, Math.min(innerWidth - 12, px));
    const sy = Math.max(12, Math.min(innerHeight - 12, py));
    const tx = Math.max(0, Math.min(max.x, sx - petWidth / 2));
    const ty = Math.max(0, Math.min(max.y, sy - petHeight + 11));
    const element = document.createElement('span'); element.className = 'treat'; element.setAttribute('aria-hidden', 'true');
    element.style.left = `${sx - 11}px`;
    element.style.top = `${sy - 11}px`;
    tripLength = Math.hypot(tx - x, ty - y);
    layer.append(element); target = { x: tx, y: ty, element };
    clearTimeout(bubbleTimer); bubble.hidden = true;
    if (redirected) {
      rerouteTimer = setTimeout(() => {
        if (target && !document.hidden) speak(reroutes.length >= 3 ? 'impatient' : 'reroute');
      }, 300);
    }
    frame = requestAnimationFrame(pursue);
  }
  on(pet, 'keydown', event => {
    if (inspecting) return;
    const delta = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, -100], ArrowDown: [0, 100] }[event.key];
    if (delta) { event.preventDefault(); snack(x + petWidth / 2 + delta[0], y + petHeight - 11 + delta[1]); }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); snack(x + petWidth / 2 + 140, y + petHeight); }
  });
  on(document, 'click', event => {
    activity();
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!(event.target instanceof Element) || event.target.closest('a, button, input, textarea, select, label, summary, dialog, [role="button"], [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]') || getSelection()?.isCollapsed === false) return;
    snack(event.clientX, event.clientY);
  });
  function reset() {
    cancelHop(); cancelBlink(); stopSnack();
    eaten = 0; pet.dataset.eaten = '0'; clearTimeout(bubbleTimer); bubble.hidden = true;
    perched = true; perchAtHero();
  }
  function perchAtHero() {
    if (anchor?.isConnected) {
      const title = anchor.getBoundingClientRect();
      move(title.right + 12, title.bottom - petHeight);
    } else {
      move(innerWidth - petWidth - 16, innerHeight - petHeight - 16);
    }
    rest();
  }
  on(window, 'resize', () => { petWidth = pet.offsetWidth; petHeight = pet.offsetHeight; if (!bubble.hidden) bubbleSize = bubble.getBoundingClientRect(); cancelHop(); cancelBlink(); stopSnack(); if (perched) perchAtHero(); else { move(x, y); rest(); } });
  function inspectReadme() {
    if (!readme?.open || inspecting) return;
    activity(); cancelHop(); cancelBlink(); stopSnack(); inspecting = true;
    clearTimeout(bubbleTimer); bubble.hidden = true;
    pet.disabled = true;
    inspection.hidden = false; inspection.append(bubble, pet);
    rest(); speak('inspect');
  }
  function finishInspection() {
    if (!inspecting) return;
    inspecting = false; inspection.hidden = true; pet.disabled = false;
    layer.append(pet, bubble);
    clearTimeout(bubbleTimer); bubble.hidden = true; activity(); rest();
  }
  const inspectionObserver = new MutationObserver(() => {
    if (readme?.open) inspectReadme(); else finishInspection();
  });
  if (readme) {
    inspectionObserver.observe(readme, { attributes: true, attributeFilter: ['open'] });
    on(readme, 'close', finishInspection);
  }
  on(document, 'keydown', activity);
  on(document, 'pointerdown', activity, { passive: true });
  on(window, 'scroll', activity, { passive: true });
  on(document, 'visibilitychange', () => {
    if (!document.hidden) { activity(); nextAside = Date.now() + asideDelay(); setWave(); startIdle(); }
    else { clearTimeout(bubbleTimer); clearTimeout(hoverTimer); clearInterval(idleTimer); hoverFolder = null; bubble.hidden = true; cancelHop(); cancelBlink(); stopSnack(); setWave(false); }
  });
  let idleTimer;
  function idleTick() {
    if (!document.hidden && !target && !hopFrame && !blinkFrame && !inspecting && !sleepy && extraReady && Date.now() - lastActivity >= 30000) {
      sleepy = true; rest(); speak('sleepy', false);
    }
    if (Date.now() >= nextAside) {
      nextAside = Date.now() + asideDelay();
      if (document.hidden || target || hopFrame || blinkFrame || inspecting || Date.now() - lastSpeech < 18000) return;
      const hour = new Date().getHours();
      const kind = sleepy ? 'sleepyAside' : hour < 6 || hour >= 22 ? 'late' : hour < 10 ? 'morning' : 'idle';
      // Larry is decorative; all remarks stay outside the accessibility tree.
      speak(kind, false);
    }
  }
  function startIdle() { clearInterval(idleTimer); if (!document.hidden) idleTimer = setInterval(idleTick, 1000); }
  startIdle();
  reset();
  if (readme?.open) inspectReadme();
  let destroyed = false;
  return Object.freeze({
    destroy() {
      if (destroyed) return;
      destroyed = true;
      events.abort();
      inspectionObserver.disconnect();
      clearInterval(idleTimer);
      for (const timer of [bubbleTimer, rerouteTimer, hoverTimer]) clearTimeout(timer);
      for (const animation of [frame, hopFrame, blinkFrame, lookFrame]) cancelAnimationFrame(animation);
      for (const artwork of [runs, looks, extras, image]) artwork.removeAttribute('src');
      inspection.remove();
      layer.remove();
    },
  });
}
