// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA95TGkLfkNI69meAZS_EwE5w7KFL84-TQ",
    authDomain: "lore-f5f5a.firebaseapp.com",
    projectId: "lore-f5f5a",
    storageBucket: "lore-f5f5a.firebasestorage.app",
    messagingSenderId: "1082670479674",
    appId: "1:1082670479674:web:fb3b05e56d71b1fcacf803",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
