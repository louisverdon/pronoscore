"use client";

import { useEffect } from "react";

export default function AdBanner() {
  useEffect(() => {
    try {
      ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle =
        (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className="w-full flex justify-center py-2 bg-gray-50 border-t border-gray-200">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-5354365570630231"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
