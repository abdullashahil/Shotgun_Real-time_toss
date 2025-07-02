"use client"

import { useRouter } from 'next/navigation';
import CreateJoinRoom from '@/components/CreateJoinRoom';

export default function RoomsEntry() {
  const router = useRouter();
  const handleReady = (roomId: string, username: string) => {
    console.log('Navigating to room:', roomId, 'with username:', username);
    router.push(`/rooms/${roomId}?user=${encodeURIComponent(username)}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <CreateJoinRoom onReady={handleReady} />
    </main>
  );
}