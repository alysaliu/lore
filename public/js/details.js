//loading state
window.addEventListener("DOMContentLoaded", () => {
  const loadingIndicator = document.getElementById("loading-indicator");
  const mainContent = document.getElementById("main-content");

  // Simulate loading for 3 seconds
  setTimeout(() => {
    loadingIndicator.classList.add("hidden");
    mainContent.classList.remove("hidden");
  }, 2000);
});

//main content section
const API_KEY = "909b5462da779f4d639070d34f685811";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const mediaType = params.get("media_type");

fetch(`https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${API_KEY}&language=en-US`)
  .then(res => res.json())
  .then(data => {
    const posterHeader = document.getElementById('poster-header');
    posterHeader.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${data.poster_path})`;

    document.getElementById("poster").src = data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : "images/placeholder.png";
    document.getElementById("title").textContent = data.title || data.name;
    document.getElementById("year").textContent = (data.release_date || data.first_air_date || "").split("-")[0];
    document.getElementById("description").textContent = data.overview || "No description available.";

    const displayType = mediaType === "movie" ? "movie" : "show";
    document.getElementById("rating-box-text").textContent = `How would you rate this ${displayType}?`;

    const genresContainer = document.getElementById("genres");
    data.genres.forEach(genre => {
      const badge = document.createElement("div");
      badge.className = "genre-badge";
      badge.textContent = genre.name;
      genresContainer.appendChild(badge);
    });

    
    
  })
  .catch(err => {
    console.error("Failed to load details:", err);
  });

//select button
document.querySelectorAll('.rating-button').forEach(ratingbtn => {
  ratingbtn.addEventListener('click', () => {
    document.querySelectorAll('.rating-button').forEach(r => r.classList.remove('selected'));
    ratingbtn.classList.add('selected');

    //selectedType = ratingbtn.getAttribute("data-type");
  });
});

// navbar
const menu = document.querySelector('#mobile-menu')
const menuLinks = document.querySelector('.navbar__menu')

menu.addEventListener('click', function() {
    menu.classList.toggle('is-active')
    menuLinks.classList.toggle('active');
})


