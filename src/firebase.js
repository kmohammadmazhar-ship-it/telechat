import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyACVghyqUsAdBDVw2JBik__XF-LRVvNgrM",
  authDomain: "telechat-2dead.firebaseapp.com",
  projectId: "telechat-2dead",
  // storageBucket hata diya gaya hai taaki CORS error na aaye
  messagingSenderId: "941917265090",
  appId: "1:941917265090:web:c7d7d7763c1fd904412f5b",
  measurementId: "G-8KR0V551S0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Storage export bhi hata diya hai