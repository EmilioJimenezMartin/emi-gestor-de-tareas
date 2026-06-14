"use client";

import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "./store";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

function AuthKeepAlive() {
  useTokenRefresh();
  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthKeepAlive />
        {children}
      </PersistGate>
    </Provider>
  );
}

