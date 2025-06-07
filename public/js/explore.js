import { auth, db } from '../../src/firebase.js';

import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  const navAuth = document.getElementById("nav-auth");
  navAuth.innerHTML = ""; // Clear old content

  if (user) {
    // Get user's Firestore document to fetch first and last name
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let initials = "";
    if (userSnap.exists()) {
      const data = userSnap.data();
      const firstName = data.firstname || "";
      const lastName = data.lastname || "";
      initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    } else {
      // Fallback to email initials
      const name = user.email;
      initials = name
        .split(/[@.\s_]/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
    }

    const profileLink = document.createElement("a");
    profileLink.href = "profile.html";
    profileLink.className = "profile-circle";
    profileLink.textContent = initials;

    navAuth.appendChild(profileLink);

  } else {
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.className = "navbar__links";
    loginLink.textContent = "Log in";

    const signupBtn = document.createElement("a");
    signupBtn.href = "signup.html";
    signupBtn.className = "signup-nav-btn";
    signupBtn.textContent = "Sign up";

    navAuth.appendChild(loginLink);
    navAuth.appendChild(signupBtn);
    console.log("No user is logged in");
  }
});


//tmdb api
const API_KEY = "909b5462da779f4d639070d34f685811";
const searchInput = document.getElementById("search-input");
const userCardsContainer = document.querySelector(".results-container");

function showEmptyState() {
  userCardsContainer.innerHTML = `
    <div class="empty-state">
      <img class="logo" src="images/Rabbit.svg" alt="rabbit" >
      Start typing to enter a rabbithole!
    </div>
  `;
}

window.addEventListener('DOMContentLoaded', () => {
  showEmptyState();
});

//chips
let selectedType = "all";

searchInput.addEventListener("input", debounce(handleSearch, 300));

function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    showEmptyState();
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
      : "images/placeholder.png";

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

    card.addEventListener('click', () => {
      window.location.href = `details.html?id=${item.id}&media_type=${item.media_type}`;
    });
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


