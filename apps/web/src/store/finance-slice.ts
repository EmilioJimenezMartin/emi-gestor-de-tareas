import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type FinanceEntryCadence = "anual" | "mensual" | "puntual";
export type FinanceEntryKind = "ingreso" | "gasto";

export type FinanceMovement = {
  _id: string;
  kind: FinanceEntryKind;
  cadence: FinanceEntryCadence;
  title: string;
  description: string;
  amount: number;
  createdAt: string;
  updatedAt?: string;
};

type FinanceState = {
  movements: FinanceMovement[];
  loaded: boolean;
};

const initialState: FinanceState = {
  movements: [],
  loaded: false,
};

export const financeSlice = createSlice({
  name: "finance",
  initialState,
  reducers: {
    setMovements(state, action: PayloadAction<{ movements: FinanceMovement[] }>) {
      state.movements = action.payload.movements;
      state.loaded = true;
    },
    upsertMovement(state, action: PayloadAction<{ movement: FinanceMovement }>) {
      const movement = action.payload.movement;
      const idx = state.movements.findIndex((m) => m._id === movement._id);
      if (idx === -1) state.movements = [movement, ...state.movements];
      else state.movements[idx] = movement;
    },
    removeMovement(state, action: PayloadAction<{ id: string }>) {
      state.movements = state.movements.filter((m) => m._id !== action.payload.id);
    },
    setLoaded(state, action: PayloadAction<{ loaded: boolean }>) {
      state.loaded = action.payload.loaded;
    },
  },
});

export const financeActions = financeSlice.actions;
export const financeReducer = financeSlice.reducer;
