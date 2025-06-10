import { auth, db } from './firebase.js';

import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

//render watchlist button
document.addEventListener("DOMContentLoaded", () => {
  renderWatchlistButton();
});

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
    checkIfAlreadyRated(user);
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

//on page load, render initial ratings box
document.addEventListener("DOMContentLoaded", () => {
  renderInitialRatingBox();
});

//main content section
const API_KEY = "909b5462da779f4d639070d34f685811";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const mediaType = params.get("media_type"); // "movie" or "tv"

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

// navbar
const menu = document.querySelector('#mobile-menu')
const menuLinks = document.querySelector('.navbar__menu')

menu.addEventListener('click', function() {
    menu.classList.toggle('is-active')
    menuLinks.classList.toggle('active');
})

//Rating box
let selectedNote = null;

function renderInitialRatingBox() {
  const ratingBox = document.getElementById("rating-box");

  ratingBox.innerHTML = `
      <h3 id="rating-box-text">How would you describe this show?</h3>
      <div class="rating-options">
        <button class="rating-button" data-sentiment="not-good">
          <span class="rating-label">Not good</span>
          <span class="rating-emoji">😒</span>
        </button>
        <button class="rating-button" data-sentiment="okay">
          <span class="rating-label">Okay</span>
          <span class="rating-emoji">😐</span>
        </button>
        <button class="rating-button" data-sentiment="good">
          <span class="rating-label">Good</span>
          <span class="rating-emoji">😊</span>
        </button>
        <button class="rating-button" data-sentiment="amazing">
          <span class="rating-label">Amazing</span>
          <span class="rating-emoji">😍</span>
        </button>
      </div>
      <div class="note">
          <input type="text" placeholder="Leave an optional note for your review" id="note-input" />                
      </div>
      <div class="button-row">
          <button class="cancel-btn" id="cancel-btn">I haven't watched it yet</button>
          <button class="next-btn">Next</button>
      </div>
  `;

  // Reattach listeners after re-render
  setupRatingButtonHandlers();
}



async function renderWatchlistButton() {
  const container = document.getElementById("watchlist-container");
  const user = auth.currentUser;

  let alreadyAdded = false;

  // If user is logged in, check if already added
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    const lists = userDoc.exists() ? userDoc.data().lists || {} : {};
    const watchlist = lists.watchlist || [];
    alreadyAdded = watchlist.some(item => item.mediaId === selectedMediaId);
  }

  // Render button regardless of auth state
  container.innerHTML = alreadyAdded
    ? `<button class="btn" id="add-to-watchlist" disabled>
         <i class="fas fa-check" id="link-icon"></i>Added to watchlist
       </button>`
    : `<button class="btn" id="add-to-watchlist">
         <i class="fas fa-plus" id="link-icon"></i>Add to watchlist
       </button>`;

  // Add click logic for not-yet-added button
  if (!alreadyAdded) {
    document.getElementById("add-to-watchlist").addEventListener("click", async () => {
      if (!auth.currentUser) {
        alert("Please log in to use your watchlist.");
        return;
      }

      const userRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const lists = userDoc.exists() ? userDoc.data().lists || {} : {};
      const watchlist = lists.watchlist || [];

      const updatedWatchlist = [...watchlist, {
        mediaId: selectedMediaId,
        mediaType: selectedMediaType,
        timestamp: new Date().toISOString()
      }];

      await setDoc(userRef, {
        lists: {
          ...lists,
          watchlist: updatedWatchlist
        }
      }, { merge: true });

      renderWatchlistButton(); // Re-render with "Added" state
    });
  }
}

//rating button handler
function setupRatingButtonHandlers() {
  selectedSentiment = null;

  //keep buttons selected
  document.querySelectorAll(".rating-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".rating-button").forEach(btn => btn.classList.remove("selected"));
      button.classList.add("selected");
      selectedSentiment = button.dataset.sentiment;
    });
  });

  //user clicks next
  const nextBtn = document.querySelector(".next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", handleNextStep);
  }

  //user cancels
  const cancelBtn = document.getElementById("cancel-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      alert("you're canceled");
      const ratingBox = document.getElementById("rating-box");
      ratingBox.innerHTML = `
        <h3>Ok! We've hidden the rating box for now.</h3>
      `;
    });
  }
}

let selectedSentiment = null;
let selectedMediaId = id; 
let selectedMediaType = mediaType; 

let comparisonGroup = [];
let insertionState = null;

async function handleNextStep() {
  if (!selectedSentiment) return alert("Please select a rating!");

  const user = auth.currentUser;
  if (!user) return alert("Please log in to rate");

  const ratingsRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(ratingsRef);
  let ratings = userDoc.exists() ? userDoc.data().ratings || {} : {};

  const note = document.getElementById("note-input").value;
  selectedNote = note;

  if (!ratings[selectedMediaType]) ratings[selectedMediaType] = {};
  if (!ratings[selectedMediaType][selectedSentiment]) ratings[selectedMediaType][selectedSentiment] = [];

  comparisonGroup = ratings[selectedMediaType][selectedSentiment];

  // If no other media: rate with default
  if (comparisonGroup.length === 0) {
    const scoreRanges = {
      "not-good": [1, 3],
      "okay": [4, 6],
      "good": [7, 8],
      "amazing": [9, 10]
    };
    const [min, max] = scoreRanges[selectedSentiment];
    const mappedScore = max;
  
    const newRating = {
      mediaId: selectedMediaId,
      mediaType: selectedMediaType,
      note: note || null,
      score: mappedScore,
      timestamp: new Date().toISOString()
    };
  
    ratings[selectedMediaType][selectedSentiment] = [newRating];
  
    await setDoc(ratingsRef, { ratings }, { merge: true });

    await incrementCachedRatingCount(user.uid);
  
    document.getElementById("rating-box").innerHTML = `<p>Thanks! You rated this a ${mappedScore}. ${note}</p>`;
    return;
  }

  // Otherwise, show comparison UI
  showComparisonUI();
}

async function showComparisonUI() {
  const ratingBox = document.getElementById("rating-box");

  // Set up insertion state if not already defined
  if (!insertionState) {
    insertionState = {
      low: 0,
      high: comparisonGroup.length - 1,
    };
  }

  const { low, high } = insertionState;

  // If search complete, insert and save
  if (low > high) {
    const position = low;

    const scoreRanges = {
      "not-good": [1, 3],
      "okay": [4, 6],
      "good": [7, 8],
      "amazing": [9, 10],
    };
    const [min, max] = scoreRanges[selectedSentiment];

    // Insert at the correct position
    comparisonGroup.splice(position, 0, {
      mediaId: selectedMediaId,
      mediaType: selectedMediaType,
      note: selectedNote || null,
      timestamp: new Date().toISOString(),
      score: 0, // Placeholder
    });

    // Recalculate scores on the updated comparisonGroup
    for (let i = 0; i < comparisonGroup.length; i++) {
      const ratio = i / (comparisonGroup.length - 1 || 1); // avoid div by 0
      const rawScore = max - (max - min) * ratio;
      comparisonGroup[i].score = Math.round(rawScore * 10) / 10;
    }

    // Save updated ratings
    const user = auth.currentUser;
    const ratingsRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(ratingsRef);
    const ratings = userDoc.exists() ? userDoc.data().ratings || {} : {};

    ratings[selectedMediaType][selectedSentiment] = comparisonGroup;
    await updateDoc(ratingsRef, { ratings });

    await incrementCachedRatingCount(user.uid);

    const finalScore = comparisonGroup[position].score;
    ratingBox.innerHTML = `<p>Thanks! You rated this a ${finalScore}. ${selectedNote || ""}</p>`;

    insertionState = null;
    return;
  }

  // Otherwise, continue comparing
  const mid = Math.floor((low + high) / 2);
  insertionState.mid = mid;

  const compareMedia = comparisonGroup[mid];
  const [currentTitle, compareTitle] = await Promise.all([
    fetchMediaName(selectedMediaId, selectedMediaType),
    fetchMediaName(compareMedia.mediaId, compareMedia.mediaType || selectedMediaType),
  ]);

  ratingBox.innerHTML = `
    <h3>Which did you like more?</h3>
    <div class="comparison-buttons">
      <button class="compare-btn" id="current-btn">${currentTitle}</button>
      <button class="compare-btn" id="compare-btn">${compareTitle}</button>
    </div>
    <div style="text-align:center">
      <a href="#" id="skip-compare">Too tough, skip</a>
    </div>
  `;

  document.getElementById("current-btn").addEventListener("click", () => handleComparison(true));
  document.getElementById("compare-btn").addEventListener("click", () => handleComparison(false));
  document.getElementById("skip-compare").addEventListener("click", handleSkip);
}

function handleComparison(prefersCurrent) {
  if (!insertionState) return;

  if (prefersCurrent) {
    insertionState.high = insertionState.mid - 1;
  } else {
    insertionState.low = insertionState.mid + 1;
  }

  showComparisonUI();
}


async function handleSkip() {
  const note = selectedNote || null;
  const user = auth.currentUser;
  const ratingsRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(ratingsRef);
  let ratings = userDoc.exists() ? userDoc.data().ratings || {} : {};

  if (!ratings[selectedMediaType]) ratings[selectedMediaType] = {};
  if (!ratings[selectedMediaType][selectedSentiment]) ratings[selectedMediaType][selectedSentiment] = [];

  const group = ratings[selectedMediaType][selectedSentiment];

  // Use mid as the comparison point
  const insertPosition = insertionState?.low ?? group.length; // place it at the correct binary position
  const scoreRanges = {
    "not-good": [1, 3],
    "okay": [4, 6],
    "good": [7, 8],
    "amazing": [9, 10]
  };
  const [min, max] = scoreRanges[selectedSentiment];

  // Insert media at the calculated position
  group.splice(insertPosition, 0, {
    mediaId: selectedMediaId,
    mediaType: selectedMediaType,
    score: 0, // temporary, recalculate below
    note: note || null,
    timestamp: new Date().toISOString()
  });

  // Recalculate all scores in group
  for (let i = 0; i < group.length; i++) {
    const positionRatio = i / (group.length - 1 || 1); // Avoid division by zero
    const rawScore = max - (max - min) * positionRatio;
    group[i].score = Math.round(rawScore * 10) / 10;
  }

  ratings[selectedMediaType][selectedSentiment] = group;
  await updateDoc(ratingsRef, { ratings });

  await incrementCachedRatingCount(user.uid);

  const finalScore = group[insertPosition].score;
  document.getElementById("rating-box").innerHTML =
    `<p>Skipped comparison. Rated same as comparison: ${finalScore}. ${note}</p>`;

  insertionState = null;
}


//fetch media name 
async function fetchMediaName(id, mediaType) {
  const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${API_KEY}&language=en-US`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    // Movies use "title", TV shows use "name"
    const name = mediaType === "movie" ? data.title : data.name;
    return name;
  } catch (err) {
    console.error("Failed to fetch media name:", err);
    return null;
  }
}

// Check Firestore on load
async function checkIfAlreadyRated(user) {
  const ratingsRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(ratingsRef);
  const ratings = userDoc.exists() ? userDoc.data().ratings || {} : {};

  for (const sentiment in ratings[mediaType] || {}) {
    for (const entry of ratings[mediaType][sentiment]) {
      if (entry.mediaId === id) {
        document.getElementById("rating-box").innerHTML =
          `<p>Your rating: ${entry.score}</p>`;
        return;
      }
    }
  }
}

async function incrementCachedRatingCount(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const current = userSnap.exists() && userSnap.data().ratingCount ? userSnap.data().ratingCount : 0;

  await updateDoc(userRef, {
    ratingCount: current + 1
  });
}