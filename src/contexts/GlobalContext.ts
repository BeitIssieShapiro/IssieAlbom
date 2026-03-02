import React from 'react';

interface GlobalContextType {
  nativeStartTime?: number;
}

export const GlobalContext = React.createContext<GlobalContextType | null>(null);
