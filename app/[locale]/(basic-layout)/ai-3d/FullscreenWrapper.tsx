"use client";

export default function FullscreenWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keep header and footer visible, just adjust layout
  return (
    <div className="w-full h-screen bg-[#0f1419] overflow-hidden flex flex-col">
      {children}
    </div>
  );
}

