import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Item = {
  _id: string;
  name: string;
  payload?: unknown;
  createdAt: string;
};

type ItemsState = {
  items: Item[];
  name: string;
  payload: string;
  loading: boolean;
  error: string | null;
  socketConnected: boolean;
};

const initialState: ItemsState = {
  items: [],
  name: "",
  payload: '{"foo":"bar"}',
  loading: false,
  error: null,
  socketConnected: false,
};

export const itemsSlice = createSlice({
  name: "items",
  initialState,
  reducers: {
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setPayload(state, action: PayloadAction<string>) {
      state.payload = action.payload;
    },
    setItems(state, action: PayloadAction<Item[]>) {
      state.items = action.payload;
    },
    addItem(state, action: PayloadAction<Item>) {
      const item = action.payload;
      const exists = state.items.some((it) => it._id === item._id);
      if (!exists) state.items = [item, ...state.items].slice(0, 50);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.socketConnected = action.payload;
    },
    resetForm(state) {
      state.name = "";
    },
  },
});

export const itemsActions = itemsSlice.actions;
export const itemsReducer = itemsSlice.reducer;

