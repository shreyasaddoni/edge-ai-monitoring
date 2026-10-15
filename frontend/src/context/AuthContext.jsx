import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check saved demo user or Firebase user
    const savedUser = localStorage.getItem('auth_user');
    const token = localStorage.getItem('auth_token');

    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error restoring user session:", e);
        setUser(null);
      }
    } else {
      setUser(null);
    }

    // Also listen to Firebase auth if active
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const idToken = await fbUser.getIdToken();
          localStorage.setItem('auth_token', idToken);
          const userData = {
            uid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            role: "Doctor"
          };
          setUser(userData);
          localStorage.setItem('auth_user', JSON.stringify(userData));
        }
      });
      setLoading(false);
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithDemo = (role = "Doctor") => {
    let demoUser;
    let token;
    if (role === "Administrator") {
      demoUser = {
        uid: "admin_demo_01",
        email: "admin@epilepsycare.org",
        name: "Clinical Administrator",
        role: "Administrator"
      };
      token = "demo_admin_token";
    } else if (role === "Caretaker") {
      demoUser = {
        uid: "caretaker_demo_01",
        email: "ramesh@epilepsycare.org",
        name: "Ramesh Sharma",
        phone: "+919876543210",
        role: "Caretaker"
      };
      token = "demo_caretaker_token";
    } else {
      demoUser = {
        uid: "doc_demo_01",
        email: "doctor@epilepsycare.org",
        name: "Dr. Sarah Jenkins, MD",
        role: "Doctor"
      };
      token = "demo_doctor_token";
    }
    setUser(demoUser);
    localStorage.setItem('auth_user', JSON.stringify(demoUser));
    localStorage.setItem('auth_token', token);
    return demoUser;
  };

  const loginWithEmail = async (email, password) => {
    try {
      const res = await api.login({ email, password });
      if (res.data?.user && res.data?.token) {
        setUser(res.data.user);
        localStorage.setItem('auth_user', JSON.stringify(res.data.user));
        localStorage.setItem('auth_token', res.data.token);
        return res.data.user;
      }
      throw new Error("Unable to log in with provided credentials.");
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Invalid email or password. Please verify your credentials.";
      throw new Error(errMsg);
    }
  };

  const registerWithEmail = async (email, password, name, role = "Doctor", phone = "") => {
    try {
      const res = await api.register({ email, password, name, role, phone });
      if (res.data?.user && res.data?.token) {
        setUser(res.data.user);
        localStorage.setItem('auth_user', JSON.stringify(res.data.user));
        localStorage.setItem('auth_token', res.data.token);
        return res.data.user;
      }
    } catch (err) {
      console.warn("Backend register API error:", err);
      const errMsg = err.response?.data?.error || err.message;
      throw new Error(errMsg || "Registration failed.");
    }

    if (auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const token = await userCred.user.getIdToken();
        const userData = {
          uid: userCred.user.uid,
          email: userCred.user.email,
          name: name || email.split('@')[0],
          role: role,
          phone: phone || ""
        };
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('auth_token', token);
        return userData;
      } catch (err) {
        console.warn("Firebase create user fallback:", err);
      }
    }

    const userData = {
      uid: `usr_${Math.random().toString(36).substring(7)}`,
      email,
      name,
      role,
      phone: phone || ""
    };
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    localStorage.setItem('auth_token', role === "Administrator" ? "demo_admin_token" : role === "Caretaker" ? "demo_caretaker_token" : "demo_doctor_token");
    return userData;
  };


  const logout = async () => {
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.error("Sign out error:", e);
      }
    }
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      loginWithDemo,
      loginWithEmail,
      registerWithEmail,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
