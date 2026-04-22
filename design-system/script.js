// ── Active nav link on scroll ──────────────────────────────────────────────

const sections = document.querySelectorAll('.section');
const navLinks  = document.querySelectorAll('.sidebar-nav a');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  },
  { rootMargin: '-20% 0px -70% 0px' }
);

sections.forEach((s) => observer.observe(s));

// ── Filter chip toggle ─────────────────────────────────────────────────────

function activateChip(chip) {
  const group = chip.closest('.component-row');
  if (!group) return;
  group.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip-active'));
  chip.classList.add('chip-active');
}

window.activateChip = activateChip;

// ── Sentiment tile toggle ──────────────────────────────────────────────────

document.querySelectorAll('.sentiment-tile').forEach((tile) => {
  tile.addEventListener('click', () => {
    tile.closest('.sentiment-grid').querySelectorAll('.sentiment-tile')
      .forEach((t) => t.classList.remove('sentiment-tile-selected'));
    tile.classList.add('sentiment-tile-selected');
  });
});
