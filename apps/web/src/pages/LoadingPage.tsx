export default function LoadingPage() {
  return (
    <div className="min-h-dvh bg-skin-50 flex items-center justify-center">
      <div className="text-center">
        <img src="/logo.png" alt="AppleTalk" className="w-16 h-16 mb-4 mx-auto animate-bounce" />
        <p className="text-gray-500 font-sans">Loading AppleTalk...</p>
      </div>
    </div>
  );
}
