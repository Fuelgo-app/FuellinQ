import * as React from "react";

export default function useAuthToken() {
  const [token, setToken] = React.useState(() => localStorage.getItem("token") || "");

  React.useEffect(() => {
    // Poll elke 300ms – betrouwbaar in dezelfde tab (storage-event vuurt daar niet)
    const id = setInterval(() => {
      const t = localStorage.getItem("token") || "";
      setToken(prev => (prev !== t ? t : prev));
    }, 300);
    return () => clearInterval(id);
  }, []);

  return token;
}
