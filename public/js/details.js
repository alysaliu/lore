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


