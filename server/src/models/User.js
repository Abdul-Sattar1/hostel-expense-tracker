import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Absent for Google-only accounts.
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    // SHA-256 of the emailed reset token; the token itself is never stored.
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    // Email change: the new address only becomes `email` once its emailed token is confirmed.
    pendingEmail: { type: String, lowercase: true, trim: true },
    pendingEmailHash: { type: String, select: false },
    pendingEmailExpires: { type: Date, select: false },
    avatarUpdatedAt: { type: Date },
    preferences: {
      reportPeriod: { type: String, enum: ['month', 'year', 'all'], default: 'month' },
      landingPage: { type: String, enum: ['dashboard', 'transactions', 'budgets', 'reports'], default: 'dashboard' },
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, r) => ({
      id: r._id,
      name: r.name,
      email: r.email,
      createdAt: r.createdAt,
      pendingEmail: r.pendingEmail ?? null,
      hasPassword: Boolean(r.passwordHash),
      googleLinked: Boolean(r.googleId),
      avatarUpdatedAt: r.avatarUpdatedAt ?? null,
      preferences: { reportPeriod: r.preferences?.reportPeriod ?? 'month', landingPage: r.preferences?.landingPage ?? 'dashboard' },
    }) },
  },
);

export default mongoose.model('User', userSchema);
