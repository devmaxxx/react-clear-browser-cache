import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Demo from './Demo';
import { start } from './server';
import './demo.css';

start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>
);
