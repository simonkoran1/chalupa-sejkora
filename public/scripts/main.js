// ===== IMAGE SLIDER =====
function initSlider(sliderEl) {
  const slides = sliderEl.querySelectorAll('.hp-slider-slide');
  const dots = sliderEl.querySelectorAll('.w-slider-dot');
  if (!slides.length) return;

  let current = 0;
  const delay = 6000;
  let timer;

  function show(index) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('w-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('w-active');
  }

  show(0);
  timer = setInterval(() => show(current + 1), delay);

  // Dot clicks
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { clearInterval(timer); show(i); timer = setInterval(() => show(current + 1), delay); });
  });
}

document.querySelectorAll('.hp-slider').forEach(initSlider);

// ===== GALLERY SLIDERS (Swiper) =====
const swiperConfig = {
  slidesPerView: 1,
  spaceBetween: 16,
  navigation: { prevEl: '.swiper-button-prev', nextEl: '.swiper-button-next' },
  breakpoints: {
    768: { slidesPerView: 2 },
    1024: { slidesPerView: 3 },
  },
};

if (document.getElementById('gallery-main')) {
  new Swiper('#gallery-main', {
    ...swiperConfig,
    navigation: { prevEl: '#gallery-main .swiper-button-prev', nextEl: '#gallery-main .swiper-button-next' },
  });
}

if (document.getElementById('gallery-surroundings')) {
  new Swiper('#gallery-surroundings', {
    ...swiperConfig,
    navigation: { prevEl: '#gallery-surroundings .swiper-button-prev', nextEl: '#gallery-surroundings .swiper-button-next' },
  });
}

// ===== FAQ ACCORDIONS =====
document.querySelectorAll('.faq_question').forEach(question => {
  const answer = question.nextElementSibling;
  const icon = question.querySelector('.faq_icon');
  if (!answer) return;

  question.addEventListener('click', () => {
    const isOpen = answer.classList.contains('open');
    answer.classList.toggle('open', !isOpen);
    if (icon) icon.classList.toggle('open', !isOpen);
  });
});

// ===== LIGHTBOX =====
let lightboxEl = null;
let lightboxLinks = [];
let lightboxIndex = 0;

function buildLightbox() {
  lightboxEl = document.createElement('div');
  lightboxEl.className = 'lightbox-backdrop';
  lightboxEl.innerHTML = `
    <button class="lightbox-close" aria-label="Close">✕</button>
    <button class="lightbox-prev" aria-label="Previous">
      <div class="gallery21_arrow-icon"><svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.31066 8.75001L9.03033 14.4697L7.96967 15.5303L0.439339 8.00001L7.96967 0.469676L9.03033 1.53034L3.31066 7.25001L15.5 7.25L15.5 8.75L3.31066 8.75001Z" fill="currentColor"/></svg></div>
    </button>
    <img class="lightbox-img" src="" alt="" />
    <button class="lightbox-next" aria-label="Next">
      <div class="gallery21_arrow-icon"><svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.6893 7.25L6.96967 1.53033L8.03033 0.469666L15.5607 8L8.03033 15.5303L6.96967 14.4697L12.6893 8.75H0.5V7.25H12.6893Z" fill="currentColor"/></svg></div>
    </button>
    <div class="lightbox-caption"></div>
  `;
  lightboxEl.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightboxEl.querySelector('.lightbox-prev').addEventListener('click', e => { e.stopPropagation(); lightboxNav(-1); });
  lightboxEl.querySelector('.lightbox-next').addEventListener('click', e => { e.stopPropagation(); lightboxNav(1); });
  lightboxEl.addEventListener('click', e => { if (e.target === lightboxEl) closeLightbox(); });

  let touchStartX = 0;
  lightboxEl.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightboxEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) lightboxNav(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('keydown', e => {
    if (!lightboxEl?.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') lightboxNav(1);
    if (e.key === 'ArrowLeft') lightboxNav(-1);
  });
  document.body.appendChild(lightboxEl);
}

function lightboxShow(index) {
  lightboxIndex = (index + lightboxLinks.length) % lightboxLinks.length;
  const link = lightboxLinks[lightboxIndex];
  lightboxEl.querySelector('.lightbox-img').src = link.dataset.url;
  lightboxEl.querySelector('.lightbox-caption').textContent = link.dataset.caption || '';
  const hasSiblings = lightboxLinks.length > 1;
  lightboxEl.querySelector('.lightbox-prev').style.display = hasSiblings ? '' : 'none';
  lightboxEl.querySelector('.lightbox-next').style.display = hasSiblings ? '' : 'none';
}

function lightboxNav(dir) { lightboxShow(lightboxIndex + dir); }

function openLightbox(links, index) {
  if (!lightboxEl) buildLightbox();
  lightboxLinks = links;
  lightboxShow(index);
  lightboxEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightboxEl?.classList.remove('open');
  document.body.style.overflow = '';
}

// Group links by their parent .gallery_slider so each gallery navigates independently
document.querySelectorAll('.gallery_slider').forEach(slider => {
  const links = Array.from(slider.querySelectorAll('.gallery_lightbox-link'));
  links.forEach((link, i) => {
    link.addEventListener('click', e => {
      e.preventDefault();
      if (link.dataset.url) openLightbox(links, i);
    });
  });
});

// ===== DATE PICKERS =====
if (typeof flatpickr !== 'undefined') {
  const lang = document.documentElement.lang;
  const isCs = lang === 'cs';

  const sharedConfig = {
    dateFormat: 'd.m.Y',
    minDate: 'today',
    locale: isCs ? 'cs' : 'default',
    disableMobile: false,
  };

  const checkIn = flatpickr('#check-in', {
    ...sharedConfig,
    onChange([date]) {
      if (date) {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        checkOut.set('minDate', next);
      }
    },
  });

  const checkOut = flatpickr('#check-out', {
    ...sharedConfig,
  });
}

// ===== RESERVATION FORM (Web3Forms) =====
const form = document.querySelector('#wf-form-Rezerva-n-formul');
const successMsg = document.querySelector('.success-message');
const failMsg = document.querySelector('.w-form-fail');
const submitBtn = form?.querySelector('button[type="submit"]');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const accessKey = new FormData(form).get('access_key');
    if (!accessKey) {
      if (failMsg) failMsg.style.display = 'block';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Odesílám…';
    }
    if (failMsg) failMsg.style.display = 'none';

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(form),
      });
      const result = await res.json();

      if (result.success) {
        if (successMsg) successMsg.style.display = 'block';
        form.style.display = 'none';
      } else {
        throw new Error(result.message || 'Failed');
      }
    } catch {
      if (failMsg) failMsg.style.display = 'block';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat';
      }
    }
  });
}
