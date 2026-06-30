//   SENCADENAS — script.js

// ── Navbar scroll effect ──────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
        navbar.style.background = 'rgba(7, 17, 31, 0.98)';
        navbar.style.boxShadow = '0 1px 24px rgba(0,0,0,0.4)';
    } else {
        navbar.style.background = 'rgba(7, 17, 31, 0.85)';
        navbar.style.boxShadow = 'none';
    }
});

// ── Burger menu (mobile) ──────────────────
const burger = document.getElementById('burger');
const navLinks = document.querySelector('.nav-links');

if (burger && navLinks) {
    burger.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        burger.setAttribute('aria-expanded', isOpen);
    });
}

// ── Scroll reveal ─────────────────────────
const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// On observe les cartes et les steps
document.querySelectorAll('.feature-card, .step, .stat').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.5s ${i * 0.08}s ease, transform 0.5s ${i * 0.08}s ease`;
    observer.observe(el);
});

// Classe pour déclencher l'animation
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `.revealed { opacity: 1 !important; transform: translateY(0) !important; }`;
    document.head.appendChild(style);
});

// ── Smooth anchor links ───────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            e.preventDefault();
            const offset = 80; // hauteur navbar
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });

            // Ferme le menu mobile si ouvert
            navLinks?.classList.remove('open');
        }
    });
});