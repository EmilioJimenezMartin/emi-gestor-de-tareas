import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import createWebStorage from "redux-persist/lib/storage/createWebStorage";
import { itemsReducer } from "./items-slice";

const storage =
  typeof window !== "undefined"
    ? createWebStorage("local")
    : {
        getItem: async (_key: string) => null,
        setItem: async (_key: string, _value: string) => undefined,
        removeItem: async (_key: string) => undefined,
      };

const rootReducer = combineReducers({
  items: persistReducer(
    {
      key: "items",
      version: 1,
      storage,
      whitelist: ["name", "payload"],
    },
    itemsReducer
  ),
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

