// src/pages/Signup.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const Signup = () => {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await signup(email, password);
      alert("登録成功");
    } catch (error) {
      alert("登録失敗: " + error.message);
    }
  };

  return (
    <div>
      <h2>サインアップ</h2>
      <form onSubmit={handleSignup}>
        <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">登録</button>
      </form>
    </div>
  );
};

export default Signup;
