import { createContext, useContext, useState, type ReactNode } from 'react';

interface AppContextType {
  planDismissed: boolean;
  dismissPlan: () => void;
}

const AppContext = createContext<AppContextType>({ planDismissed: false, dismissPlan: () => {} });

export const useAppContext = () => useContext(AppContext);

export function AppProvider({ children }: { children: ReactNode }) {
  const [planDismissed, setPlanDismissed] = useState(false);
  return (
    <AppContext.Provider value={{ planDismissed, dismissPlan: () => setPlanDismissed(true) }}>
      {children}
    </AppContext.Provider>
  );
}
