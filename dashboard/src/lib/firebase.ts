/**
 * Firebase Configuration — Affiliate Shoppe
 * Firestore: Structured data (campaigns, links, threads)
 * Realtime DB: Live counters & publisher status
 */

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyDr45dIRNX8wE12nZzA7FlspVv-hIThPQk",
    authDomain: "affialtesystem.firebaseapp.com",
    projectId: "affialtesystem",
    storageBucket: "affialtesystem.firebasestorage.app",
    messagingSenderId: "747989220527",
    appId: "1:747989220527:web:2fafc84621017e742c685a",
    measurementId: "G-C3G8MR8FFS",
    databaseURL: "https://affialtesystem-default-rtdb.firebaseio.com",
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firestore — campaigns, affiliate_links, threads
export const db = getFirestore(app);

// Realtime Database — live counters, publisher status
export const rtdb = getDatabase(app);

export default app;
