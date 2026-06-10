import mongoose, { Schema, Document } from "mongoose";

export interface IKeywordRank {
    keyword: string;
    position: number | null;   // posición 1-48 en el SERP de amazon.com, null = no encontrado
    page1: boolean;
}

export interface ISeoSnapshot extends Document {
    nicheId: string;
    asin: string;
    ranks: IKeywordRank[];
    autocompleteHit: boolean;       // ¿aparece el nicho en el autocomplete de Amazon?
    autocompleteTerms: string[];    // qué sugiere Amazon hoy para el prefijo del nicho
    ownReviews: number | null;      // reseñas propias detectadas en el SERP
    topCompetitorReviews: number[]; // reviews del top del SERP (velocity de competencia)
    createdAt: Date;
}

const SeoSnapshotSchema = new Schema<ISeoSnapshot>(
    {
        nicheId: { type: String, required: true, index: true },
        asin: { type: String, required: true },
        ranks: [{
            keyword: { type: String, required: true },
            position: { type: Number, default: null },
            page1: { type: Boolean, default: false },
        }],
        autocompleteHit: { type: Boolean, default: false },
        autocompleteTerms: [{ type: String }],
        ownReviews: { type: Number, default: null },
        topCompetitorReviews: [{ type: Number }],
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export const SeoSnapshot =
    mongoose.models.SeoSnapshot || mongoose.model<ISeoSnapshot>("SeoSnapshot", SeoSnapshotSchema);
