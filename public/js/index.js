import { auth, db } from 'src/firebase.js';

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