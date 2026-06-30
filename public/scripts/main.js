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

function openLightbox(url, caption) {
  if (!lightboxEl) {
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox-backdrop';
    lightboxEl.innerHTML = `
      <button class="lightbox-close" aria-label="Close">✕</button>
      <img class="lightbox-img" src="" alt="" />
      <div class="lightbox-caption"></div>
    `;
    lightboxEl.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightboxEl.addEventListener('click', e => { if (e.target === lightboxEl) closeLightbox(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
    document.body.appendChild(lightboxEl);
  }
  lightboxEl.querySelector('.lightbox-img').src = url;
  lightboxEl.querySelector('.lightbox-caption').textContent = caption || '';
  lightboxEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightboxEl?.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.gallery_lightbox-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const url = link.dataset.url;
    const caption = link.dataset.caption;
    if (url) openLightbox(url, caption);
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
