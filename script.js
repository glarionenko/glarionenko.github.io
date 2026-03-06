(() => {
  const header = document.querySelector('.header');
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));

  const getHeaderH = () => (header ? header.getBoundingClientRect().height : 0);

  // Собираем секции по ссылкам меню (кроме #top)
  const items = navLinks
    .map(a => {
      const hash = a.getAttribute('href');
      if (!hash || hash === '#' || hash === '#top') return null;
      const el = document.querySelector(hash);
      if (!el) return null;
      return { hash, el };
    })
    .filter(Boolean);

  const setActive = (hash) => {
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === hash));
  };

  // --- Плавный скролл + мгновенная подсветка ---
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    const hash = a.getAttribute('href');
    if (!hash || hash === '#') return;

    const target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();

    // сразу подсветим, что нажали
    setActive(hash);

    const top = target.getBoundingClientRect().top + window.pageYOffset - getHeaderH() - 10;
    window.scrollTo({ top, behavior: 'smooth' });

    history.pushState(null, '', hash);
  });

  // --- ScrollSpy по scrollY (стабильно) ---
  let ticking = false;

  const computeActive = () => {
    const y = window.pageYOffset;
    const line = y + getHeaderH() + 20; // “линия считывания” под шапкой

    // Если мы ещё выше первой секции -> Главная
    const first = items[0];
    if (!first) {
      setActive('#top');
      return;
    }

    const firstTop = first.el.getBoundingClientRect().top + y;
    if (line < firstTop + 1) {
      setActive('#top');
      return;
    }

    // Иначе выбираем последнюю секцию, верх которой уже прошёл line
    let current = first.hash;
    for (const it of items) {
      const top = it.el.getBoundingClientRect().top + y;
      if (top <= line) current = it.hash;
      else break;
    }

    setActive(current);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      computeActive();
      ticking = false;
    });
  };

  // Обновляем при скролле + при ресайзе (шапка меняет высоту)
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // Стартовое состояние
  // Если открыли с hash в URL — подсветим его, иначе #top
  const initialHash = location.hash && navLinks.some(a => a.getAttribute('href') === location.hash)
    ? location.hash
    : '#top';

  setActive(initialHash);
  computeActive();
})();

(() => {
  const bg = document.querySelector('.heroBgImg');
  if (!bg) return;

  const IMAGES = {
    closed: './backclosed.png',
    half: './backhalfopened.png',
    full: './backfullopened.png',
  };

  // preload чтобы не мигало при первой смене
  Object.values(IMAGES).forEach(src => {
    const img = new Image();
    img.src = src;
  });

  let current = 'closed';
  let busy = false;

  function setHeroBg(state) {
    if (!IMAGES[state]) return;
    if (busy || state === current) return;

    busy = true;

    // fade out
    bg.classList.add('is-fading-out');
    bg.classList.remove('is-fading-in');

    // после затухания меняем картинку и проявляем
    window.setTimeout(() => {
      bg.style.backgroundImage = `url('${IMAGES[state]}')`;
      current = state;

      bg.classList.remove('is-fading-out');
      bg.classList.add('is-fading-in');

      window.setTimeout(() => {
        bg.classList.remove('is-fading-in');
        busy = false;
      }, 480);

    }, 480);
  }

  // экспортируем в window — можно дергать руками из консоли / из триггеров
  window.setHeroBgClosed = () => setHeroBg('closed');
  window.setHeroBgHalf   = () => setHeroBg('half');
  window.setHeroBgFull   = () => setHeroBg('full');

  // гарантируем стартовое состояние
  // (если background-image уже задан в HTML — просто синхронизируем current)
  current = 'closed';
})();


// helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(() => {
  const pill = document.getElementById('alicaToggle');
  if (!pill) return;

  const pillText = pill.querySelector('.pillText');

  // состояние: false = "дома" (closed), true = "спать" (full)
  let isSleepMode = false;
  let isBusy = false;

  // НА СТАРТЕ: closed
  // setHeroBgClosed?.(); // если хочешь явно дернуть при загрузке

  const runToSleep = async () => {
    // Дом -> Спать:
    // Все непрозрачное -> исчезает CLOSED -> пауза -> исчезает HALF
    const half = document.querySelector('.heroBgHalf');
    const closed = document.querySelector('.heroBgClosed');
    if (!half || !closed) return;

    // Сначала делаем HALF полностью видимым без плавности
    setLayerTransition(half, 0);
    half.style.opacity = '1';
    forceReflow(half);
    setLayerTransition(half, 900);

    // CLOSED тоже фиксируем в 1 без рывка
    setLayerTransition(closed, 0);
    closed.style.opacity = '1';
    forceReflow(closed);
    setLayerTransition(closed, 900);

    // 1) Плавно прячем CLOSED
    closed.style.opacity = '0';
    await sleep(900);

    // 2) Держим HALF видимым ~1с
    await sleep(200);

    // 3) Плавно прячем HALF (в 2 раза медленнее)
    setLayerTransition(half, 2500);
    half.style.opacity = '0';
    await sleep(1800);
  };

  const runToHome = async () => {
    // Спать -> Дом: делаем HALF видимым, затем плавно возвращаем CLOSED
    const half = document.querySelector('.heroBgHalf');
    const closed = document.querySelector('.heroBgClosed');
    if (!half || !closed) return;

    setLayerTransition(half, 0);
    half.style.opacity = '1';
    forceReflow(half);
    setLayerTransition(half, 900);

    setLayerTransition(closed, 900);
    closed.style.opacity = '1';
    await sleep(900);
  };

  const updateUI = () => {
    pill.setAttribute('aria-pressed', String(isSleepMode));
    if (pillText) pillText.textContent = isSleepMode ? 'Алиса, пока!' : 'Алиса, я дома!';
  };

  const onToggle = async () => {
    if (isBusy) return;
    isBusy = true;
    pill.disabled = true; // на всякий случай, чтобы не спамили

    try {
      if (!isSleepMode) {
        // включаем "спать"
        isSleepMode = true;
        updateUI();              // текст меняем сразу
        await sleep(500);        // маленькая задержка “как будто Алиса услышала”
        await runToSleep();
      } else {
        // возвращаем "дом"
        isSleepMode = false;
        updateUI();
        await sleep(150);
        await runToHome();
      }
    } finally {
      pill.disabled = false;
      isBusy = false;
    }
  };

  updateUI();
  pill.addEventListener('click', onToggle);
})();


function setHeroBgClosed(){
  const half = document.querySelector('.heroBgHalf');
  const closed = document.querySelector('.heroBgClosed');
  if (!half || !closed) return;

  // CLOSED сверху, HALF полностью видим под ним
  half.style.opacity = '1';
  closed.style.opacity = '1';
}

function setLayerTransition(el, ms){
  if (!el) return;
  el.style.transitionDuration = `${ms}ms`;
}

function forceReflow(el){
  // Принудительный reflow, чтобы мгновенные стили применились
  void el.offsetHeight;
}

function setHeroBgTransition(ms){
  const half = document.querySelector('.heroBgHalf');
  const closed = document.querySelector('.heroBgClosed');
  if (!half || !closed) return;

  const value = `${ms}ms`;
  half.style.transitionDuration = value;
  closed.style.transitionDuration = value;
}

function setHeroBgHalf(){
  const half = document.querySelector('.heroBgHalf');
  const closed = document.querySelector('.heroBgClosed');
  if (!half || !closed) return;

  // Среднее состояние: HALF видим, CLOSED скрыт
  half.style.opacity = '1';
  closed.style.opacity = '0';
}

function setHeroBgFull(){
  const half = document.querySelector('.heroBgHalf');
  const closed = document.querySelector('.heroBgClosed');
  if (!half || !closed) return;

  half.style.opacity = '0';
  closed.style.opacity = '0';
}

document.addEventListener('DOMContentLoaded', () => {
  setHeroBgClosed();
});
