import React from 'react';
import { AppProvider } from './context/AppContext';
import { AppShell } from './components/AppShell';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
};

export default App;
