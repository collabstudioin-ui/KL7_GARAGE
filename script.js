document.addEventListener('DOMContentLoaded', () => {
  const DURATION = 4500;
  const slides = document.querySelectorAll('.slide');
  const dots   = document.querySelectorAll('.dot');
  const TOTAL  = slides.length;
  let current  = 0;
  let autoTimer = null;

  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = ((idx % TOTAL) + TOTAL) % TOTAL;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function schedule() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { goTo(current + 1); schedule(); }, DURATION);
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goTo(i); schedule(); });
  });

  // pause on hover
  const hero = document.getElementById('hero');
  hero.addEventListener('mouseenter', () => clearTimeout(autoTimer));
  hero.addEventListener('mouseleave', () => schedule());

  // swipe support
  let txStart = 0;
  hero.addEventListener('touchstart', (e) => { txStart = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - txStart;
    if (Math.abs(dx) > 50) { goTo(dx < 0 ? current + 1 : current - 1); schedule(); }
  });

  // nav scroll effect
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  schedule();
});