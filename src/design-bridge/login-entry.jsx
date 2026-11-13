import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { LoginScreen } from './login-screen.jsx';
import { RegisterScreen } from './register-screen.jsx';
import { navigatePrototypeScreen, notifyPrototypeScreen, prototypeScreenUrl } from './auth-navigation.js';

function AuthPrototype() {
  const [screen, setScreen] = useState(() => new URL(location.href).searchParams.get('screen') === 'register' ? 'register' : 'login');
  const [phone, setPhone] = useState('');
  useEffect(() => { document.title = screen === 'register' ? 'ЗАМЕРX — Регистрация' : 'ЗАМЕРX — Вход'; }, [screen]);
  const show = next => {
    history.replaceState(history.state, '', prototypeScreenUrl(next, location.href));
    setScreen(next);
    notifyPrototypeScreen(next);
  };
  return screen === 'register'
    ? <RegisterScreen onBack={() => show('login')} onRegistered={values => { setPhone(values.phone); show('login'); }} />
    : <LoginScreen initialPhone={phone} onCreateAccount={() => show('register')} onSignIn={() => navigatePrototypeScreen('app')} />;
}

const host = document.getElementById('login-root');
if (host) ReactDOM.createRoot(host).render(<AuthPrototype />);
