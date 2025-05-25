// src/components/LogoutButton.jsx
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login"); // ログアウト後、ログイン画面へリダイレクト
    } catch (error) {
      console.error("ログアウトエラー:", error);
      alert("ログアウトに失敗しました");
    }
  };

  return <button onClick={handleLogout}>ログアウト</button>;
};

export default LogoutButton;
