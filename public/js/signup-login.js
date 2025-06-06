import { auth, db } from '../../src/firebase.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// SIGNUP
document.getElementById("signup-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("Signed up:", user.email);
    if (user && user.uid) {
      console.log("User UID:", user.uid);
    
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
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
      window.location.href = "explore.html"; // change to your actual page
    } else {
      console.error("Invalid user object:", user);
      alert("Signup failed: " + error.message);
    }

  } catch (error) {
    console.error("Signup error:", error.message);
  }
});

// import { auth, db } from '../../src/firebase.js'; 

// import {
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   onAuthStateChanged,
//   signOut
// } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// const user = auth.currentUser;
// console.log("user email", user);
// createUserWithEmailAndPassword(auth, user)
//   .then(async (userCredential) => {
//     const user = userCredential.user;
//     console.log('User is signed up:', user.email);

//     // Now save to Firestore
//     const userRef = doc(db, "users", user.uid);
//     await setDoc(userRef, {
//       email: user.email,
//       createdAt: new Date()
//     });

//     console.log('User document written to Firestore!');
//   })
//   .catch((error) => {
//     console.error("Signup error:", error.code, error.message);
//   });


// // Sign up
// document.getElementById("signup-form")?.addEventListener("submit", (e) => {
//   e.preventDefault();
//   const email = document.getElementById("signup-email").value;
//   const password = document.getElementById("signup-password").value;

//   createUserWithEmailAndPassword(auth, email, password)
//     .then(userCredential => {
//       console.log("Signed up:", userCredential.user);
//     })
//     .catch(error => {
//       console.error("Signup error:", error.message);
//     });
// });

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
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is logged in:", user.email);
    // Show/hide elements as needed
  } else {
    console.log("No user is logged in");
  }
});