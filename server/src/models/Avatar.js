import mongoose from 'mongoose';

// Profile picture bytes, one per user, kept out of the User document so every user query stays small.
// Stored in MongoDB (binary, not base64) so no persistent disk is needed on the host.
const avatarSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export default mongoose.model('Avatar', avatarSchema);
