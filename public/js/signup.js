import { auth, db } from './firebase.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// SIGNUP
document.getElementById("signup-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const firstname = document.getElementById("firstname").value;
  const lastname = document.getElementById("lastname").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("Signed up:", user.email);
    if (user && user.uid) {
      console.log("User UID:", user.uid);
    
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        firstname: firstname,
        lastname: lastname,
        email: user.email,
        createdAt: serverTimestamp()
      });
    
      const listRef = doc(db, "users", user.uid, "lists", "watchlist");
      await setDoc(listRef, {
        items: []
      });

      const followersRef = doc(db, "users", user.uid, "followers", "followerUserId");
      await setDoc(followersRef, {
        uids: []
      });

      const followingRef = doc(db, "users", user.uid, "following", "followingUserId");
      await setDoc(followingRef, {
        uids: []
      });
    
      console.log("Firestore user document and list created!");

      // ✅ Redirect after signup
      window.location.href = "explore.html";
    } else {
      console.error("Invalid user object:", user);
      alert("Signup failed: " + error.message);
    }

  } catch (error) {
    console.error("Signup error:", error.message);
    alert("Signup error: " + error.message);
  }
});

// Log in
document.getElementById("login-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(userCredential => {
      console.log("Logged in:", userCredential.user);
    })
    .catch(error => {
      console.error("Login error:", error.message);
    });
});

// Log out
document.getElementById("logout-button")?.addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("Logged out");
    })
    .catch(error => {
      console.error("Logout error:", error.message);
    });
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

