"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  validateFirebaseConfig,
  mapFirebaseAuthError,
  initFirebaseAnalyticsClient,
  FirebaseValidationResult,
} from "@/lib/firebase";

export interface UserProfileData {
  email: string | null;
  displayName: string | null;
  whatsapp: string;
  whatsappVerified: boolean;
  createdAt?: any;
  updatedAt?: any;
  whatsappVerifiedAt?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserProfileData | null;
  loading: boolean;
  validation: FirebaseValidationResult;
  signup: (email: string, pass: string) => Promise<any>;
  login: (email: string, pass: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<void>;
  updateUserWhatsApp: (phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<FirebaseValidationResult>(() => validateFirebaseConfig());

  useEffect(() => {
    // Run validation at client startup
    const res = validateFirebaseConfig();
    setValidation(res);

    if (!res.isValid) {
      setLoading(false);
      return;
    }

    // Lazily initialize Firebase Analytics on client only after hydration
    const analyticsTimer = window.setTimeout(() => {
      void initFirebaseAnalyticsClient();
    }, 1500);

    // 2-second safety timeout: never trap the app in infinite loading if Firebase Auth hangs
    const safetyTimer = window.setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[SignalDesk Auth] Auth state resolution timed out after 2s; releasing loading lock.");
          return false;
        }
        return prev;
      });
    }, 2000);

    let docUnsubscribe: (() => void) | null = null;

    try {
      const authUnsubscribe = onAuthStateChanged(
        auth,
        async (currentUser) => {
          window.clearTimeout(safetyTimer);

          // Clean up previous user listener if any
          if (docUnsubscribe) {
            docUnsubscribe();
            docUnsubscribe = null;
          }

          setUser(currentUser);
          // Unblock auth loading immediately so routes can render
          setLoading(false);

        if (currentUser) {
          // Asynchronously initialize and listen to users/{uid} document without blocking UI
          try {
            const { db, doc, getDoc, setDoc, onSnapshot, serverTimestamp } = await import(
              "@/lib/firestore"
            );
            const userDocRef = doc(db, "users", currentUser.uid);

            // Real-time snapshot listener on users/{uid}
            docUnsubscribe = onSnapshot(
              userDocRef,
              async (snap) => {
                if (snap.exists()) {
                  const data = snap.data();
                  setUserData({
                    email: data.email || currentUser.email || null,
                    displayName: data.displayName || currentUser.displayName || null,
                    whatsapp: data.whatsapp || "",
                    whatsappVerified: Boolean(data.whatsappVerified),
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    whatsappVerifiedAt: data.whatsappVerifiedAt,
                  });
                } else {
                  // Document doesn't exist yet, lazily create defaults
                  try {
                    await setDoc(
                      userDocRef,
                      {
                        email: currentUser.email || "",
                        displayName: currentUser.displayName || "",
                        whatsapp: "",
                        whatsappVerified: false,
                        createdAt: serverTimestamp(),
                      },
                      { merge: true }
                    );
                  } catch (setErr) {
                    console.warn("Could not create user document defaults:", setErr);
                  }
                }
              },
              (err) => {
                console.warn("Firestore user document subscription notice:", err);
              }
            );
          } catch (err) {
            console.warn("Error hydrating user profile document:", err);
          }
        } else {
          // Explicitly clear user profile data on logout
          setUserData(null);
        }
      },
      (authErr) => {
        window.clearTimeout(safetyTimer);
        console.warn("[SignalDesk Auth] onAuthStateChanged error:", authErr);
        setLoading(false);
      });

      return () => {
        window.clearTimeout(safetyTimer);
        window.clearTimeout(analyticsTimer);
        authUnsubscribe();
        if (docUnsubscribe) {
          docUnsubscribe();
        }
      };
    } catch (err) {
      window.clearTimeout(safetyTimer);
      window.clearTimeout(analyticsTimer);
      setLoading(false);
    }
  }, []);

  const signup = async (email: string, pass: string) => {
    const val = validateFirebaseConfig();
    if (!val.isValid) {
      throw new Error(
        `Firebase setup incomplete. Missing or invalid variable(s): ${val.missingVars.join(", ")} in web/.env.local`
      );
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const { db, doc, getDoc, setDoc, serverTimestamp } = await import("@/lib/firestore");
      const userDocRef = doc(db, "users", res.user.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await setDoc(
          userDocRef,
          {
            email: res.user.email || "",
            displayName: res.user.displayName || "",
            whatsapp: "",
            whatsappVerified: false,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return res;
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const login = async (email: string, pass: string) => {
    const val = validateFirebaseConfig();
    if (!val.isValid) {
      throw new Error(
        `Firebase setup incomplete. Missing or invalid variable(s): ${val.missingVars.join(", ")} in web/.env.local`
      );
    }

    try {
      return await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const loginWithGoogle = async () => {
    const val = validateFirebaseConfig();
    if (!val.isValid) {
      throw new Error(
        `Firebase setup incomplete. Missing or invalid variable(s): ${val.missingVars.join(", ")} in web/.env.local`
      );
    }

    try {
      const res = await signInWithPopup(auth, googleProvider);
      const { db, doc, getDoc, setDoc, serverTimestamp } = await import("@/lib/firestore");
      const userDocRef = doc(db, "users", res.user.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await setDoc(
          userDocRef,
          {
            email: res.user.email || "",
            displayName: res.user.displayName || "",
            whatsapp: "",
            whatsappVerified: false,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return res;
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // Ignored
    } finally {
      setUser(null);
      setUserData(null);
    }
  };

  const updateUserWhatsApp = async (phone: string) => {
    if (!user) return;
    const { db, doc, setDoc, serverTimestamp } = await import("@/lib/firestore");
    const userDocRef = doc(db, "users", user.uid);
    // Writes users/{uid}.whatsapp only (whatsappVerified can only be modified by backend Admin SDK)
    await setDoc(
      userDocRef,
      {
        whatsapp: phone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        validation,
        signup,
        login,
        loginWithGoogle,
        logout,
        updateUserWhatsApp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
