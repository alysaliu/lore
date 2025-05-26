//tmdb api
const API_KEY = "909b5462da779f4d639070d34f685811";
const searchInput = document.getElementById("search-input");
const userCardsContainer = document.querySelector(".results-container");

//chips
let selectedType = "all";
// document.querySelectorAll('.chip').forEach(chip => {
//   chip.addEventListener('click', () => {
//     // Remove 'selected' from all chips
//     document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));

//     // Add 'selected' to the clicked chip
//     chip.classList.add('selected');
    
//   });
// });



searchInput.addEventListener("input", debounce(handleSearch, 300));


function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    userCardsContainer.innerHTML = ""; // Clear if empty
    return;
  }

  fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(
      query
    )}&page=1&include_adult=false`
  )
    .then((res) => res.json())
    .then((data) => {
      displayResults(data.results);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

function displayResults(results) {
  userCardsContainer.innerHTML = "";

  if (!results || results.length === 0) {
    userCardsContainer.innerHTML = "<p>No results found.</p>";
    return;
  }

  results.forEach(item => {
    // Skip if it doesn't match selectedType (unless selectedType is "all")
    if (selectedType !== "all" && item.media_type !== selectedType) return;

    const title = item.title || item.name || "No Title";
    const year = (item.release_date || item.first_air_date || "").split("-")[0];
    const overview = item.overview || "No description available.";
    const posterPath = item.poster_path
      ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
      : "/public/images/placeholder.png";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${posterPath}" alt="${title}" class="poster-image" />
      <div class="text-container">
        <div class="title-container">
          <div class="header">${title}</div>
          <div class="metadata">${year || ""}</div>
        </div>
        <div class="body">${overview}</div>
      </div>
    `;
    userCardsContainer.appendChild(card);
  });
}

// debounce helper
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');

    selectedType = chip.getAttribute("data-type");
    handleSearch(); // re-run the search with the new filter
  });
});

// navbar
const menu = document.querySelector('#mobile-menu')
const menuLinks = document.querySelector('.navbar__menu')

menu.addEventListener('click', function() {
    menu.classList.toggle('is-active')
    menuLinks.classList.toggle('active');
})


