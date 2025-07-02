import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-black">
      <h1 className="text-4xl font-bold mb-6">Welcome to Shotgun Toss</h1>
      <p className="mb-8">Real-time Cricket Team Selection</p>
      <Link href="/rooms" className=" text-blue-600 px-6 py-3 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200">
          Get Started
      </Link>

    </main>
  );
}
