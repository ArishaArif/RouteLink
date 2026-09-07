import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextValue {
  isConnected: boolean;
  isWifi: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  isWifi: true,
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isWifi, setIsWifi] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
      setIsWifi(state.type === 'wifi' || state.type === 'ethernet');
    });
    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, isWifi }}>
      {children}
    </NetworkContext.Provider>
  );
}
