"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      {theme === "light" ? (
        <Sun
          className="h-4 w-4 cursor-pointer"
          onClick={() => setTheme("dark")}
        />
      ) : (
        <Moon
          className="h-4 w-4 cursor-pointer"
          onClick={() => setTheme("light")}
        />
      )}
    </>
  );
}
