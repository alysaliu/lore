const menu = document.querySelector('#mobile-menu')
const menuLinks = document.querySelector('.navbar__menu')

menu.addEventListener('click', function() {
    menu.classList.toggle('is-active')
    menuLinks.classList.toggle('active');
})

const slides = [
    { image: 'images/Littlewomen.svg', color: '#4DB5FF'},
    { image: 'images/Moonlightkingdom.svg', color: '#EEDA44'},
    { image: 'images/Severance.svg', color: '#fff'}
];
  
  let current = 0;
  const container = document.getElementById('slideshow-container');
  const text = document.getElementById('blurry-text');
  const circle = document.getElementById('blurred-circle');
  
  function updateBackground() {
    container.style.backgroundImage = `url(${slides[current].image})`;
    text.style.color = slides[current].color;
    circle.style.background = slides[current].color;
    current = (current + 1) % slides.length;
  }
  
  updateBackground(); // Set initial image
  setInterval(updateBackground, 4000); // Change every 4 seconds