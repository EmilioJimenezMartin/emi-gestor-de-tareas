import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ImageModelState {
    selectedModelId: string;
}

const initialState: ImageModelState = {
    selectedModelId: "pollinations-flux",
};

export const imageModelSlice = createSlice({
    name: "imageModel",
    initialState,
    reducers: {
        setSelectedModelId(state, action: PayloadAction<string>) {
            state.selectedModelId = action.payload;
        },
    },
});

export const { setSelectedModelId } = imageModelSlice.actions;
export const imageModelReducer = imageModelSlice.reducer;
