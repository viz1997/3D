"use client";

import Cookies from "js-cookie";
import { useCallback, useEffect, useState } from "react";

export function useCookieConsent() {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setConsented(Cookies.get("cookieConsent") === "true");
    } catch {
      setConsented(false);
    }
  }, []);

  const acceptConsent = useCallback(() => {
    Cookies.set("cookieConsent", "true", {
      expires: 365,
      path: "/",
      sameSite: "lax",
    });
    setConsented(true);
  }, []);

  const revokeConsent = useCallback(() => {
    Cookies.remove("cookieConsent", { path: "/" });
    setConsented(false);
  }, []);

  return { consented, mounted, acceptConsent, revokeConsent };
}


