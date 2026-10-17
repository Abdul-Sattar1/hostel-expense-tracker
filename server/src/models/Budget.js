import mongoose from 'mongoose';

// A recurring monthly spending limit for one expense category. Spending is never stored here:
// it is calculated from the student's transactions each time.
const budgetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    limit: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true },
);

budgetSchema.index({ owner: 1, category: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);
