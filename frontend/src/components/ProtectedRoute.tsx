import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../features/auth/stores/useAuthStore";
import { Loader2 } from "lucide-react";
import GlobalWebSocket from "./GlobalWebSocket";
import GlobalAlertModal from "./GlobalAlertModal";

export default function ProtectedRoute() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f6]">
        <Loader2 className="animate-spin text-[#ac2d00]" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <>
      <GlobalWebSocket />
      <GlobalAlertModal />
      <Outlet />
    </>
  );
}
