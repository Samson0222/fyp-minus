// frontend/src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'; // Fallback

  useEffect(() => {
    console.log(`Attempting to fetch from: ${backendUrl}/`);
    fetch(`${backendUrl}/`) // Fetch root endpoint of backend
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Network response was not ok: ${res.status} ${res.statusText} - ${errorText}`);
        }
        return res.json();
      })
      .then((data) => {
        setBackendMessage(data.message);
        console.log("Received from backend:", data);
      })
      .catch((error) => {
        console.error("Failed to fetch backend message:", error);
        setBackendMessage(`Error connecting to backend: ${error.message}`);
      });
  }, [backendUrl]); // Re-run if backendUrl changes (though it shouldn't here)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Voice Assistant Interface</h1>
      <div className="p-4 bg-gray-800 rounded shadow-md">
        <p>Status:</p>
        <p className="font-mono text-lg break-all">
          {backendMessage === null ? 'Connecting to backend...' : backendMessage}
        </p>
      </div>
      {/* Future components go here */}
    </main>
  );
}