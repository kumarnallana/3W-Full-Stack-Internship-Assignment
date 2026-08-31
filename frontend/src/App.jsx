import { Navigate, Route, Routes } from "react-router-dom";
import LoadingScreen from "./components/feedback/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import FeedPage from "./pages/FeedPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen label="Checking your session" />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen label="Preparing your account" />;
  }

  if (status === "authenticated") {
    return <Navigate to="/feed" replace />;
  }

  return children;
}

export default function App() {
  const { status } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={status === "authenticated" ? "/feed" : "/login"}
            replace
          />
        }
      />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <SignupPage />
          </GuestRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

