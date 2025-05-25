// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAuth, signInAnonymously } from "firebase/auth";


const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      console.log("ログイン成功、ホームへ遷移します");
      navigate("/");
    } catch (error) {
      alert("ログイン失敗: " + error.message);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(getAuth());
      console.log("匿名ユーザーとしてログインしました");
      navigate("/");
    } catch (err) {
      alert("ゲストログイン失敗: " + err.message);
    }
  };


  // onTouchStart で強制的に focus() を呼び出す
  const handleTouchStart = (e) => {
    e.target.focus();
  };

  return (
    <div>
      <h2>ログイン</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          onTouchStart={handleTouchStart}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          onTouchStart={handleTouchStart}
        />
        <button type="submit">ログイン</button>
      </form>

      {/* 👇 ゲストログインボタンを追加 */}
      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleGuestLogin}>ゲストとして試す</button>
      </div>
    </div>
  );

};

export default Login;
