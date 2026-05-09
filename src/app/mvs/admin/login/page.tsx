import LoginForm from '@/components/admin/LoginForm';

export default function AdminLoginPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen bg-zinc-50 px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Admin Login</h1>
          <p className="text-zinc-500 mt-1">MVS</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
