import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    date: { type: Date, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, r) => ({
        id: r._id,
        type: r.type,
        amount: r.amount,
        category: r.category,
        description: r.description,
        date: r.date.toISOString().slice(0, 10),
      }),
    },
  },
);

transactionSchema.index({ owner: 1, date: -1 });

export default mongoose.model('Transaction', transactionSchema);
