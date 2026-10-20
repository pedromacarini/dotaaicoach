import React from 'react';
import { createRoot } from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { Overlay } from './components/Overlay';
import './style.css';
import './economy.css';

const mode = new URLSearchParams(location.search).get('mode');
document.documentElement.dataset.mode = mode === 'overlay' ? 'overlay' : 'dashboard';
const root = document.getElementById('root');
if (!root) throw new Error('Elemento root não encontrado');
createRoot(root).render(<React.StrictMode>{mode === 'overlay' ? <Overlay /> : <Dashboard />}</React.StrictMode>);
