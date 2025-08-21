// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  // Se quiser suportar várias abas simultâneas, descomente a linha abaixo:
  // persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAoK7zcyf0OIS57zsRcgsXDomOhJuLkaZg",
  authDomain: "app-geracao-ideias.firebaseapp.com",
  projectId: "app-geracao-ideias",
  storageBucket: "app-geracao-ideias.firebasestorage.app",
  messagingSenderId: "1045938808647",
  appId: "1:1045938808647:web:b317fc40d3c14263ad4e62",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firestore com cache local persistente (IndexedDB)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    // Se quiser habilitar multi-abas sem conflitos:
    // tabManager: persistentMultipleTabManager(),
  }),
});
