import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

// The session lives in an HttpOnly cookie the browser sends automatically; JavaScript never sees the
// token. On load we ask the server who we are (GET /auth/me) instead of trusting anything stored locally.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!userRef.current) return;
      setExpired(true);
      setUser(null);
    });
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const authenticate = (path) => async (body) => {
    const data = await api(path, { method: 'POST', body });
    setExpired(false);
    setLoggedOut(false);
    setUser(data.user);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setLoggedOut(true);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, updateUser: setUser, forget: () => { setLoggedOut(true); setUser(null); }, loading, expired, loggedOut, login: authenticate('/auth/login'), google: (credential) => authenticate('/auth/google')({ credential }), register: authenticate('/auth/register'), logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
