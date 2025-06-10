import { auth, db } from './firebase.js';

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_KEY = "909b5462da779f4d639070d34f685811";
const params = new URLSearchParams(window.location.search);
const selectedUserId = params.get("uid");

// Listen for auth state changes
// onAuthStateChanged(auth, async (user) => {
//   const navAuth = document.getElementById("nav-auth");
//   navAuth.innerHTML = ""; // Clear old content

//   if (user) {
//     // Get user's Firestore document to fetch first and last name
//     const userRef = doc(db, "users", user.uid);
//     const userSnap = await getDoc(userRef);
//     console.log("A user is logged in");

//     // FOLLOW / UNFOLLOW LOGIC
//     if (selectedUserId && selectedUserId !== user.uid) {
//       const followBtn = document.getElementById("follow-button");
//       if (followBtn) {
//         const currentUserId = user.uid;

//         const followingRef = doc(db, "users", currentUserId, "following", selectedUserId);
//         const followerRef = doc(db, "users", selectedUserId, "followers", currentUserId);

//         const followingSnap = await getDoc(followingRef);
//         let isFollowing = followingSnap.exists();

//         // Set initial button text
//         followBtn.textContent = isFollowing ? "Unfollow" : "Follow";

//         followBtn.addEventListener("click", async () => {
//           const timestamp = new Date().toISOString();

//           if (isFollowing) {
//             // Unfollow: remove both docs
//             await Promise.all([
//               deleteDoc(followingRef),
//               deleteDoc(followerRef)
//             ]);
//             followBtn.textContent = "Follow";
//             isFollowing = false;
//           } else {
//             // Follow: add both docs
//             await Promise.all([
//               setDoc(followingRef, {
//                 followingUserId: selectedUserId,
//                 timestamp
//               }),
//               setDoc(followerRef, {
//                 followerUserId: currentUserId,
//                 timestamp
//               })
//             ]);
//             followBtn.textContent = "Unfollow";
//             isFollowing = true;
//           }
//         });
//       }
//     }
//     const selectedUserRef = doc(db, "users", selectedUserId);
//     const selectedUserSnap = await getDoc(selectedUserRef);

//     let initials = "";
//     if (userSnap.exists()) {
//       const data = userSnap.data();
//       const firstName = data.firstname || "";
//       const lastName = data.lastname || "";
//       initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
//     } 
//     if (selectedUserSnap.exists()) {
//       const data = selectedUserSnap.data();
//       const fullName = `${data.firstname || ""} ${data.lastname || ""}`.trim();

//       // Set name and email
//       document.getElementById("user-name").textContent = fullName || "Unnamed";
//       document.getElementById("user-email").textContent = selectedUserRef.email || "";

//       const total = data.ratingCount || 0;
//       document.getElementById("rating-count").textContent = total;

//       // Followers count
//       const followersCol = collection(db, "users", user.uid, "followers");
//       const followersSnap = await getDocs(followersCol);
//       const followersCount = followersSnap.size;
//       document.getElementById("followers-count").textContent = followersCount;
//       console.log("followers", followersCount);

//       // Following count
//       const followingCol = collection(db, "users", user.uid, "following");
//       const followingSnap = await getDocs(followingCol);
//       const followingCount = followingSnap.size;
//       document.getElementById("following-count").textContent = followingCount;
//       console.log("following", followingCount);
//     } 
//     else {
//       // Fallback to email initials
//       const name = user.email;
//       initials = name
//         .split(/[@.\s_]/)
//         .filter(Boolean)
//         .slice(0, 2)
//         .map(part => part.charAt(0).toUpperCase())
//         .join("");
//     }

//     const profileLink = document.createElement("a");
//     profileLink.href = "profile.html";
//     profileLink.className = "profile-circle";
//     profileLink.textContent = initials;

//     navAuth.appendChild(profileLink);

//     selectTab("movies");

//     //share profile
//     const shareBtn = document.getElementById("share");

//     if (shareBtn) {
//       shareBtn.addEventListener("click", () => {
//         const shareLink = `${window.location.origin}/user.html?uid=${selectedUserId}`;

//         // Optionally copy to clipboard
//         navigator.clipboard.writeText(shareLink).then(() => {
//           alert("Profile link copied to clipboard!");
//         }).catch(err => {
//           console.error("Failed to copy: ", err);
//           alert("Here's your profile link: " + shareLink);
//         });
//       });
//     }

//   } else {
//     const loginLink = document.createElement("a");
//     loginLink.href = "login.html";
//     loginLink.className = "navbar__links";
//     loginLink.textContent = "Log in";

//     const signupBtn = document.createElement("a");
//     signupBtn.href = "signup.html";
//     signupBtn.className = "signup-nav-btn";
//     signupBtn.textContent = "Sign up";

//     navAuth.appendChild(loginLink);
//     navAuth.appendChild(signupBtn);
//     console.log("No user is logged in");

//     tabContent.innerHTML = "<p>Please log in to view your rated movies.</p>";
//   }
// });

onAuthStateChanged(auth, async (user) => {
  const navAuth = document.getElementById("nav-auth");
  navAuth.innerHTML = ""; // Clear old content

  if (user) {
    const currentUserId = user.uid;
    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    console.log("A user is logged in");

    // FOLLOW / UNFOLLOW LOGIC
    if (selectedUserId && selectedUserId !== currentUserId) {
      const followBtn = document.getElementById("follow-button");
      if (followBtn) {
        const followingRef = doc(db, "users", currentUserId, "following", selectedUserId);
        const followerRef = doc(db, "users", selectedUserId, "followers", currentUserId);

        const followingSnap = await getDoc(followingRef);
        let isFollowing = followingSnap.exists();

        // Set initial button text
        followBtn.textContent = isFollowing ? "Unfollow" : "Follow";

        followBtn.addEventListener("click", async () => {
          const timestamp = new Date().toISOString();

          if (isFollowing) {
            // Unfollow: delete both documents
            await Promise.all([
              deleteDoc(followingRef),
              deleteDoc(followerRef)
            ]);
            followBtn.textContent = "Follow";
            isFollowing = false;
          } else {
            // Follow: create both documents with timestamps
            await Promise.all([
              setDoc(followingRef, { timestamp }),
              setDoc(followerRef, { timestamp })
            ]);
            followBtn.textContent = "Unfollow";
            isFollowing = true;
          }
        });
      }
    }

    const selectedUserRef = doc(db, "users", selectedUserId);
    const selectedUserSnap = await getDoc(selectedUserRef);

    let initials = "";
    if (userSnap.exists()) {
      const data = userSnap.data();
      const firstName = data.firstname || "";
      const lastName = data.lastname || "";
      initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }

    if (selectedUserSnap.exists()) {
      const data = selectedUserSnap.data();
      const fullName = `${data.firstname || ""} ${data.lastname || ""}`.trim();

      // Set name and email
      document.getElementById("user-name").textContent = fullName || "Unnamed";
      document.getElementById("user-email").textContent = selectedUserRef.email || "";

      const total = data.ratingCount || 0;
      document.getElementById("rating-count").textContent = total;

      // Followers count
      const followersCol = collection(db, "users", selectedUserId, "followers");
      const followersSnap = await getDocs(followersCol);
      const followersCount = followersSnap.size;
      document.getElementById("followers-count").textContent = followersCount;
      console.log("followers", followersCount);

      // Following count
      const followingCol = collection(db, "users", selectedUserId, "following");
      const followingSnap = await getDocs(followingCol);
      const followingCount = followingSnap.size;
      document.getElementById("following-count").textContent = followingCount;
      console.log("following", followingCount);
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

    selectTab("movies");

    const shareBtn = document.getElementById("share");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        const shareLink = `${window.location.origin}/user.html?uid=${selectedUserId}`;
        navigator.clipboard.writeText(shareLink).then(() => {
          alert("Profile link copied to clipboard!");
        }).catch(err => {
          console.error("Failed to copy: ", err);
          alert("Here's your profile link: " + shareLink);
        });
      });
    }

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

    tabContent.innerHTML = "<p>Please log in to view your rated movies.</p>";
  }
});


//tabs
const tabButtons = document.querySelectorAll(".tab");
const tabContent = document.getElementById("tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectTab(button.dataset.tab);
  });
});

const tabData = {
  movies: "<p>Here are your rated movies.</p>",
  shows: "<p>Here are your rated shows.</p>",
  watchlist: "<p>This is your watchlist.</p>"
};

function selectTab(tabKey) {
  tabButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabKey);
  });

  if (tabKey === "movies") {
    loadRatedMovies();
  }
  if (tabKey === "shows") {
    loadRatedShows();
  } 
  if (tabKey === "watchlist") {
    loadWatchlist();
  } else {
    tabContent.innerHTML = tabData[tabKey];
  }
}

async function loadRatedMovies() {
  const user = auth.currentUser;
  if (!user) return tabContent.innerHTML = "<p>Please log in to view your rated movies.</p>";

  const ratingsRef = doc(db, "users", selectedUserId);
  const userDoc = await getDoc(ratingsRef);
  const data = userDoc.exists() ? userDoc.data().ratings || {} : {};

  const itemRatings = [];
  for (const sentiment in data.movie || {}) {
    for (const entry of data.movie[sentiment]) {
      itemRatings.push({ ...entry, sentiment });
    }
  }

  if (itemRatings.length === 0) {
    tabContent.innerHTML = "<p>No rated movies yet.</p>";
    return;
  }

  // Sort by score descending and assign rank
  itemRatings.sort((a, b) => b.score - a.score);
  itemRatings.forEach((item, index) => item.rank = index + 1);

  // Build HTML content
  const enrichedItems = await Promise.all(
    itemRatings.map(async (item) => {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${item.mediaId}?api_key=${API_KEY}&language=en-US`);
      const data = await res.json();

      return {
        ...item,
        title: data.title || "Untitled",
        releaseDate: data.release_date || "Unknown",
        posterPath: data.poster_path || "",
        genres: data.genres?.map(g => g.name) || [],
      };
    })
  );

  const html = enrichedItems.map(item => `
  <a href="details.html?id=${item.mediaId}&media_type=${item.mediaType}" class="card-link">
    <div class="card">
      <img src="https://image.tmdb.org/t/p/w200${item.posterPath}" alt="${item.title}" class="poster-image"/>
      <div class="text-container">
        <div class="title-container">
          <div class="title">${item.rank}. ${item.title}</div>
          <div class="metadata">${item.releaseDate.split("-")[0] || ""}</div>
          <div class="genres">
          ${item.genres.map(g => `<span class="genre-badge">${g}</span>`).join("")}
          </div>
        </div>
        <div class="body">${item.note}</div>
      </div>
      <div class="score">
        ${item.score}
      </div>      
    </div>
  </a>
  `).join("");

  tabContent.innerHTML = html;
}

async function loadRatedShows() {
  const user = auth.currentUser;
  if (!user) {
    tabContent.innerHTML = "<p>Please log in to view your rated shows.</p>";
    return;
  }

  const ratingsRef = doc(db, "users", selectedUserId);
  const userDoc = await getDoc(ratingsRef);
  const data = userDoc.exists() ? userDoc.data().ratings || {} : {};

  const showRatings = [];
  for (const sentiment in data.tv || {}) {
    for (const entry of data.tv[sentiment]) {
      showRatings.push({ ...entry, sentiment });
    }
  }

  if (showRatings.length === 0) {
    tabContent.innerHTML = "<p>No rated shows yet.</p>";
    return;
  }

  showRatings.sort((a, b) => b.score - a.score);
  showRatings.forEach((item, index) => item.rank = index + 1);

  const enrichedItems = await Promise.all(
    showRatings.map(async item => {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${item.mediaId}?api_key=${API_KEY}&language=en-US`);
      const data = await res.json();

      return {
        ...item,
        title: data.name || "Untitled",
        releaseDate: data.first_air_date || "Unknown",
        posterPath: data.poster_path || "",
        genres: data.genres?.map(g => g.name) || [],
        mediaType: "tv"
      };
    })
  );

  const html = enrichedItems.map(item => `
    <a href="details.html?id=${item.mediaId}&media_type=${item.mediaType}" class="card-link">
      <div class="card">
        <img src="https://image.tmdb.org/t/p/w200${item.posterPath}" alt="${item.title}" class="poster-image"/>
        <div class="text-container">
          <div class="title-container">
            <div class="title">${item.rank}. ${item.title}</div>
            <div class="metadata">${item.releaseDate.split("-")[0] || ""}</div>
            <div class="genres">
              ${item.genres.map(g => `<span class="genre-badge">${g}</span>`).join("")}
            </div>
          </div>
          <div class="body">${item.note || "—"}</div>
        </div>
        <div class="score">${item.score}</div>      
      </div>
    </a>
  `).join("");

  tabContent.innerHTML = html;
}

async function loadWatchlist() {
  const user = auth.currentUser;
  if (!user) {
    tabContent.innerHTML = "<p>Please log in to view your watchlist.</p>";
    return;
  }

  const userRef = doc(db, "users", selectedUserId);
  const userDoc = await getDoc(userRef);
  const data = userDoc.exists() ? userDoc.data() : {};
  const watchlist = data.lists?.watchlist || [];

  if (watchlist.length === 0) {
    tabContent.innerHTML = "<p>Your watchlist is empty.</p>";
    return;
  }

  const enrichedItems = await Promise.all(
    watchlist.map(async (item, index) => {
      const res = await fetch(`https://api.themoviedb.org/3/${item.mediaType}/${item.mediaId}?api_key=${API_KEY}&language=en-US`);
      const details = await res.json();

      return {
        rank: index + 1,
        mediaId: item.mediaId,
        mediaType: item.media_type,
        title: details.title || details.name || "Untitled",
        releaseDate: details.release_date || details.first_air_date || "Unknown",
        posterPath: details.poster_path || "",
        genres: details.genres?.map(g => g.name) || [],
        overview: details.overview || "No description available."
      };
    })
  );

  const html = enrichedItems.map(item => `
    <a href="details.html?id=${item.mediaId}&media_type=${item.mediaType}" class="card-link">
      <div class="card">
        <img src="https://image.tmdb.org/t/p/w200${item.posterPath}" alt="${item.title}" class="poster-image"/>
        <div class="text-container">
          <div class="title-container">
            <div class="title">${item.title}</div>
            <div class="metadata">${item.releaseDate.split("-")[0] || ""}</div>
            <div class="genres">
              ${item.genres.map(g => `<span class="genre-badge">${g}</span>`).join("")}
            </div>
          </div>
          <div class="body">${item.overview}</div>
        </div>
      </div>
    </a>
  `).join("");

  tabContent.innerHTML = html;
}